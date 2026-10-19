"""HTTP behavior of /v1/budgets against real Postgres with RLS."""

from __future__ import annotations

import asyncio
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import httpx
import pytest
from sqlalchemy import event, select, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from tests.security.conftest import ApiClientFactory, TenantSessionFactory, assert_tenant_isolated

from largent.core.ids import new_uuid7
from largent.modules.budgets.models import Budget

NOW = datetime(2026, 10, 18, 12, 0, tzinfo=UTC)  # a Sunday; the week began Monday 2026-10-12
TODAY = date(2026, 10, 18)


def day(offset: int = 0) -> str:
    return (TODAY + timedelta(days=offset)).isoformat()


async def make_account(client: httpx.AsyncClient, name: str = "Wallet") -> str:
    response = await client.post("/v1/accounts", json={"name": name, "type": "cash"})
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


async def make_category(
    client: httpx.AsyncClient, name: str = "Food", kind: str = "expense", **extra: object
) -> str:
    response = await client.post("/v1/categories", json={"name": name, "kind": kind, **extra})
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


def body(category_id: str, **extra: object) -> dict[str, object]:
    return {"category_id": category_id, "period": "weekly", "limit_minor": 7800, **extra}


async def make_budget(
    client: httpx.AsyncClient, category_id: str, **extra: object
) -> dict[str, Any]:
    response = await client.post("/v1/budgets", json=body(category_id, **extra))
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


async def spend(
    client: httpx.AsyncClient,
    account_id: str,
    category_id: str | None,
    on: str,
    amount_minor: int,
    kind: str = "expense",
) -> str:
    response = await client.post(
        "/v1/transactions",
        json={
            "account_id": account_id,
            "category_id": category_id,
            "kind": kind,
            "amount_minor": amount_minor,
            "occurred_on": on,
        },
    )
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


async def set_timezone(as_tenant: TenantSessionFactory, user_id: UUID, timezone: str) -> None:
    async with as_tenant(user_id) as session:
        await session.execute(
            text("UPDATE users SET timezone = :tz WHERE id = :id"), {"tz": timezone, "id": user_id}
        )


async def test_create_read_update_list_and_soft_delete(
    api_client: ApiClientFactory, as_tenant: TenantSessionFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    category_id = await make_category(client)
    budget_id = new_uuid7()

    created = await client.post(
        "/v1/budgets", json=body(category_id, id=str(budget_id), limit_minor=7800)
    )

    assert created.status_code == 201
    result = created.json()
    assert result["id"] == str(budget_id)
    assert result["category_id"] == category_id
    assert result["period"] == "weekly"
    assert result["limit_minor"] == 7800
    assert result["currency"] == "GHS"
    assert result["is_archived"] is False
    assert result["spent_minor"] == 0
    assert result["status"] == "within"
    assert set(result) == {
        "id",
        "category_id",
        "period",
        "limit_minor",
        "currency",
        "is_archived",
        "spent_minor",
        "status",
        "created_at",
        "updated_at",
    }
    assert (await client.get(f"/v1/budgets/{budget_id}")).json() == result
    assert [i["id"] for i in (await client.get("/v1/budgets")).json()["items"]] == [str(budget_id)]

    updated = await client.patch(
        f"/v1/budgets/{budget_id}", json={"limit_minor": 9000, "is_archived": True}
    )
    assert updated.status_code == 200
    assert updated.json()["limit_minor"] == 9000
    assert updated.json()["is_archived"] is True
    assert updated.json()["period"] == "weekly"
    assert updated.json()["category_id"] == category_id
    assert updated.json()["created_at"] == result["created_at"]
    assert updated.json()["updated_at"] > result["updated_at"]
    assert (await client.get(f"/v1/budgets/{budget_id}")).json() == updated.json()

    assert (await client.delete(f"/v1/budgets/{budget_id}")).status_code == 204
    assert (await client.get(f"/v1/budgets/{budget_id}")).status_code == 404
    patched = await client.patch(f"/v1/budgets/{budget_id}", json={"limit_minor": 1})
    assert patched.status_code == 404
    assert patched.json()["code"] == "not_found"
    assert (await client.get("/v1/budgets", params={"include_archived": True})).json()[
        "items"
    ] == []

    async with as_tenant(tenant_a) as session:
        row = await session.scalar(select(Budget).where(Budget.id == budget_id))
        assert row is not None
        assert row.deleted_at is not None
        assert row.limit_minor == 9000


async def test_delete_is_idempotent_and_silent_for_unknown_ids(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    budget = await make_budget(client, await make_category(client))

    assert (await client.delete(f"/v1/budgets/{budget['id']}")).status_code == 204
    assert (await client.delete(f"/v1/budgets/{budget['id']}")).status_code == 204
    assert (await client.delete(f"/v1/budgets/{new_uuid7()}")).status_code == 204


async def test_create_is_idempotent_by_client_id(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    category_id = await make_category(client)
    other_category = await make_category(client, "Transport")
    payload = body(category_id, id=str(new_uuid7()))

    created = await client.post("/v1/budgets", json=payload)
    replay = await client.post("/v1/budgets", json=payload)
    conflicts = [
        await client.post("/v1/budgets", json={**payload, "limit_minor": 7801}),
        await client.post("/v1/budgets", json={**payload, "period": "monthly"}),
        await client.post("/v1/budgets", json={**payload, "category_id": other_category}),
        await client.post("/v1/budgets", json={**payload, "is_archived": True}),
    ]

    assert created.status_code == 201
    assert replay.status_code == 200
    assert replay.json() == created.json()
    for conflict in conflicts:
        assert conflict.status_code == 409
        assert conflict.json()["code"] == "id_conflict"
        assert conflict.headers["content-type"] == "application/problem+json"
    assert len((await client.get("/v1/budgets")).json()["items"]) == 1


async def test_a_replay_still_succeeds_after_the_category_is_archived(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    category_id = await make_category(client)
    payload = body(category_id, id=str(new_uuid7()))
    await client.post("/v1/budgets", json=payload)
    await client.patch(f"/v1/categories/{category_id}", json={"is_archived": True})

    replay = await client.post("/v1/budgets", json=payload)

    assert replay.status_code == 200


async def test_concurrent_identical_creates_yield_one_row(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    payload = body(await make_category(client), id=str(new_uuid7()))

    responses = await asyncio.gather(*(client.post("/v1/budgets", json=payload) for _ in range(5)))

    assert sorted(response.status_code for response in responses) == [200, 200, 200, 200, 201]
    assert len((await client.get("/v1/budgets")).json()["items"]) == 1


async def test_concurrent_creates_for_one_category_and_period_yield_one_budget(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    category_id = await make_category(client)

    responses = await asyncio.gather(
        *(client.post("/v1/budgets", json=body(category_id, id=str(new_uuid7()))) for _ in range(5))
    )

    assert sorted(response.status_code for response in responses) == [201, 409, 409, 409, 409]
    assert {r.json()["code"] for r in responses if r.status_code == 409} == {"duplicate_budget"}
    assert len((await client.get("/v1/budgets")).json()["items"]) == 1


async def test_a_deleted_id_cannot_be_recreated(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    payload = body(await make_category(client), id=str(new_uuid7()))
    await client.post("/v1/budgets", json=payload)
    await client.delete(f"/v1/budgets/{payload['id']}")

    response = await client.post("/v1/budgets", json=payload)

    assert response.status_code == 409
    assert response.json()["code"] == "id_conflict"


async def test_one_active_budget_per_category_and_period(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    category_id = await make_category(client)
    other_category = await make_category(client, "Transport")
    first = await make_budget(client, category_id, period="weekly")

    duplicate = await client.post("/v1/budgets", json=body(category_id, period="weekly"))
    other_period = await client.post("/v1/budgets", json=body(category_id, period="monthly"))
    other_category_budget = await client.post("/v1/budgets", json=body(other_category))
    await client.delete(f"/v1/budgets/{first['id']}")
    recreated = await client.post("/v1/budgets", json=body(category_id, period="weekly"))

    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "duplicate_budget"
    assert duplicate.headers["content-type"] == "application/problem+json"
    assert other_period.status_code == 201
    assert other_category_budget.status_code == 201
    assert recreated.status_code == 201
    assert recreated.json()["id"] != first["id"]


async def test_an_archived_budget_still_blocks_a_duplicate(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    category_id = await make_category(client)
    await make_budget(client, category_id, is_archived=True)

    duplicate = await client.post("/v1/budgets", json=body(category_id))

    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "duplicate_budget"


@pytest.mark.parametrize(
    "overrides",
    [
        {"limit_minor": 0},
        {"limit_minor": -1},
        {"limit_minor": 10**12 + 1},
        {"limit_minor": 12.5},
        {"limit_minor": 100.0},
        {"limit_minor": "100"},
        {"limit_minor": True},
        {"limit_minor": None},
        {"period": "daily"},
        {"period": "WEEKLY"},
        {"period": None},
        {"currency": "USD"},
        {"is_archived": "yes"},
        {"id": "not-a-uuid"},
        {"id": str(uuid4())},
        {"category_id": "not-a-uuid"},
        {"category_id": None},
        {"kind": "income"},
        {"user_id": str(uuid4())},
        {"spent_minor": 5},
        {"status": "within"},
        {"deleted_at": None},
    ],
)
async def test_create_rejects_invalid_payloads(
    api_client: ApiClientFactory, tenant_a: UUID, overrides: dict[str, object]
) -> None:
    client = await api_client(tenant_a, now=NOW)
    payload = {**body(await make_category(client)), **overrides}

    response = await client.post("/v1/budgets", json=payload)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert response.headers["content-type"] == "application/problem+json"
    assert (await client.get("/v1/budgets")).json()["items"] == []


@pytest.mark.parametrize("missing", ["category_id", "period", "limit_minor"])
async def test_create_requires_the_mandatory_fields(
    api_client: ApiClientFactory, tenant_a: UUID, missing: str
) -> None:
    client = await api_client(tenant_a, now=NOW)
    payload = body(await make_category(client))
    del payload[missing]

    response = await client.post("/v1/budgets", json=payload)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


async def test_limit_boundaries_are_accepted(api_client: ApiClientFactory, tenant_a: UUID) -> None:
    client = await api_client(tenant_a, now=NOW)

    smallest = await client.post(
        "/v1/budgets", json=body(await make_category(client, "A"), limit_minor=1)
    )
    largest = await client.post(
        "/v1/budgets", json=body(await make_category(client, "B"), limit_minor=10**12)
    )

    assert smallest.status_code == largest.status_code == 201
    assert largest.json()["limit_minor"] == 10**12


async def test_an_income_category_is_a_kind_mismatch(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    income = await make_category(client, "Salary", "income")
    archived_income = await make_category(client, "Old pay", "income", is_archived=True)

    for category_id in (income, archived_income):
        response = await client.post("/v1/budgets", json=body(category_id))
        assert response.status_code == 422
        assert response.json()["code"] == "kind_mismatch"
        assert response.json()["field"] == "category_id"
        assert response.headers["content-type"] == "application/problem+json"
    assert (await client.get("/v1/budgets")).json()["items"] == []


async def test_unknown_deleted_and_foreign_categories_are_one_error(
    api_client: ApiClientFactory, tenant_a: UUID, tenant_b: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    client_b = await api_client(tenant_b, now=NOW)
    deleted_category = await make_category(client, "Gone")
    await client.delete(f"/v1/categories/{deleted_category}")
    foreign_category = await make_category(client_b, "B food")

    failures = [
        await client.post("/v1/budgets", json=body(str(new_uuid7()))),
        await client.post("/v1/budgets", json=body(foreign_category)),
        await client.post("/v1/budgets", json=body(deleted_category)),
    ]

    for response in failures:
        assert response.status_code == 422
        assert response.json()["code"] == "invalid_reference"
        assert response.json()["field"] == "category_id"
        assert response.headers["content-type"] == "application/problem+json"
    assert failures[0].json() == failures[1].json() == failures[2].json()
    assert (await client.get("/v1/budgets")).json()["items"] == []
    assert (await client_b.get("/v1/budgets")).json()["items"] == []


async def test_an_archived_category_cannot_take_a_new_budget(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    archived = await make_category(client, "Old", is_archived=True)

    response = await client.post("/v1/budgets", json=body(archived))

    assert response.status_code == 422
    assert response.json()["code"] == "archived_reference"
    assert response.json()["field"] == "category_id"
    assert (await client.get("/v1/budgets")).json()["items"] == []


async def test_an_existing_budget_survives_its_category_being_archived_or_deleted(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    category_id = await make_category(client)
    budget = await make_budget(client, category_id)
    await client.patch(f"/v1/categories/{category_id}", json={"is_archived": True})

    edited = await client.patch(f"/v1/budgets/{budget['id']}", json={"limit_minor": 100})

    assert edited.status_code == 200
    assert edited.json()["limit_minor"] == 100


async def test_spent_covers_this_week_or_month_to_date(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)
    food = await make_category(client, "Food")
    transport = await make_category(client, "Transport")
    unbudgeted = await make_category(client, "Fun")
    weekly = await make_budget(client, food, period="weekly", limit_minor=1000)
    monthly = await make_budget(client, food, period="monthly", limit_minor=1250)
    transport_weekly = await make_budget(client, transport, period="weekly", limit_minor=100)

    await spend(client, account_id, food, "2026-09-30", 1000)  # last month
    await spend(client, account_id, food, "2026-10-01", 100)  # month start
    await spend(client, account_id, food, "2026-10-11", 200)  # Sunday before the week
    await spend(client, account_id, food, "2026-10-12", 300)  # Monday, week start
    await spend(client, account_id, food, day(0), 400)  # today
    await spend(client, account_id, food, day(1), 5000)  # tomorrow is not "to date"
    removed = await spend(client, account_id, food, day(0), 7000)
    await client.delete(f"/v1/transactions/{removed}")
    await spend(client, account_id, transport, day(-1), 50)
    await spend(client, account_id, unbudgeted, day(0), 9999)
    await spend(client, account_id, None, day(0), 9999)
    await spend(client, account_id, None, day(0), 9999, kind="income")

    def lookup(items: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        return {item["id"]: item for item in items}

    listed = lookup((await client.get("/v1/budgets")).json()["items"])

    assert (listed[weekly["id"]]["spent_minor"], listed[weekly["id"]]["status"]) == (700, "within")
    assert (listed[monthly["id"]]["spent_minor"], listed[monthly["id"]]["status"]) == (
        1000,
        "near_limit",
    )
    assert (
        listed[transport_weekly["id"]]["spent_minor"],
        listed[transport_weekly["id"]]["status"],
    ) == (50, "within")
    for budget in (weekly, monthly, transport_weekly):
        single = (await client.get(f"/v1/budgets/{budget['id']}")).json()
        assert single == listed[budget["id"]]


async def test_status_follows_the_limit_thresholds(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)
    category_id = await make_category(client)
    budget = await make_budget(client, category_id, limit_minor=1000)
    path = f"/v1/budgets/{budget['id']}"
    ids: list[str] = []

    seen: list[tuple[int, str]] = []
    for amount in (799, 1, 200, 1):  # running totals: 799, 800, 1000, 1001
        ids.append(await spend(client, account_id, category_id, day(0), amount))
        current = (await client.get(path)).json()
        seen.append((current["spent_minor"], current["status"]))
    await client.delete(f"/v1/transactions/{ids[-1]}")
    after_delete = (await client.get(path)).json()
    raised = await client.patch(path, json={"limit_minor": 2000})

    assert seen == [
        (799, "within"),
        (800, "near_limit"),
        (1000, "near_limit"),
        (1001, "over_limit"),
    ]
    assert (after_delete["spent_minor"], after_delete["status"]) == (1000, "near_limit")
    assert (raised.json()["spent_minor"], raised.json()["status"]) == (1000, "within")


async def test_the_period_follows_the_users_timezone(
    api_client: ApiClientFactory, as_tenant: TenantSessionFactory, tenant_a: UUID
) -> None:
    # At 2026-10-18 12:00 UTC it is already Monday the 19th in Kiritimati (UTC+14).
    await set_timezone(as_tenant, tenant_a, "Pacific/Kiritimati")
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)
    category_id = await make_category(client)
    weekly = await make_budget(client, category_id, period="weekly")
    monthly = await make_budget(client, category_id, period="monthly")
    await spend(client, account_id, category_id, day(0), 300)  # Sunday, last week there
    await spend(client, account_id, category_id, day(1), 400)  # Monday, this week there

    assert (await client.get(f"/v1/budgets/{weekly['id']}")).json()["spent_minor"] == 400
    assert (await client.get(f"/v1/budgets/{monthly['id']}")).json()["spent_minor"] == 700


async def test_the_month_rolls_over_in_the_users_timezone(
    api_client: ApiClientFactory, as_tenant: TenantSessionFactory, tenant_a: UUID, tenant_b: UUID
) -> None:
    # At 2026-10-31 12:00 UTC it is Sunday 1 November in Kiritimati but still October in Accra.
    late_october = datetime(2026, 10, 31, 12, 0, tzinfo=UTC)
    await set_timezone(as_tenant, tenant_a, "Pacific/Kiritimati")
    spent: dict[str, tuple[int, int]] = {}
    for name, user_id in (("kiritimati", tenant_a), ("accra", tenant_b)):
        client = await api_client(user_id, now=late_october)
        account_id = await make_account(client)
        category_id = await make_category(client)
        weekly = await make_budget(client, category_id, period="weekly")
        monthly = await make_budget(client, category_id, period="monthly")
        await spend(client, account_id, category_id, "2026-10-31", 300)
        await spend(client, account_id, category_id, "2026-11-01", 400)
        spent[name] = (
            (await client.get(f"/v1/budgets/{weekly['id']}")).json()["spent_minor"],
            (await client.get(f"/v1/budgets/{monthly['id']}")).json()["spent_minor"],
        )

    # In Accra the 1 Nov transaction is in the future; in Kiritimati the month restarted on 1 Nov.
    assert spent["kiritimati"] == (700, 400)
    assert spent["accra"] == (300, 300)


async def test_listing_spending_uses_one_grouped_query(
    api_client: ApiClientFactory, app_engine: AsyncEngine, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)
    for index in range(6):
        category_id = await make_category(client, f"Category {index}")
        await make_budget(client, category_id, period="weekly")
        await make_budget(client, category_id, period="monthly")
        await spend(client, account_id, category_id, day(0), 100 + index)
    statements: list[str] = []

    def record(
        _connection: Connection,
        _cursor: object,
        statement: str,
        _parameters: object,
        _context: object,
        _executemany: bool,
    ) -> None:
        statements.append(statement)

    event.listen(app_engine.sync_engine, "before_cursor_execute", record)
    try:
        listed = await client.get("/v1/budgets")
    finally:
        event.remove(app_engine.sync_engine, "before_cursor_execute", record)

    assert len(listed.json()["items"]) == 12
    assert len([s for s in statements if "FROM transactions" in s]) == 1
    assert {item["spent_minor"] for item in listed.json()["items"]} == {
        100,
        101,
        102,
        103,
        104,
        105,
    }


async def test_list_hides_archived_budgets_unless_asked(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    live = await make_budget(client, await make_category(client, "Food"))
    archived = await make_budget(client, await make_category(client, "Fun"), is_archived=True)

    default = (await client.get("/v1/budgets")).json()["items"]
    everything = (await client.get("/v1/budgets", params={"include_archived": True})).json()[
        "items"
    ]

    assert [item["id"] for item in default] == [live["id"]]
    assert [item["id"] for item in everything] == [live["id"], archived["id"]]


async def test_pagination_is_stable_across_rows_that_share_a_timestamp(
    api_client: ApiClientFactory, as_tenant: TenantSessionFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    stamp = datetime(2026, 10, 1, 8, 0, 0, 123456, tzinfo=UTC)
    seeded: list[tuple[UUID, datetime]] = []
    async with as_tenant(tenant_a) as session:
        for tick in (0, 0, 0, 1, 1, 2, 2, 2, 3):
            category_id = new_uuid7()
            await session.execute(
                text(
                    "INSERT INTO categories (id, user_id, kind, name) "
                    "VALUES (:id, :u, 'expense', :n)"
                ),
                {"id": category_id, "u": tenant_a, "n": f"Category {category_id}"},
            )
            row_id = new_uuid7()
            created_at = stamp + timedelta(seconds=tick)
            await session.execute(
                text(
                    "INSERT INTO budgets (id, user_id, category_id, period, limit_minor, "
                    "created_at) VALUES (:id, :u, :c, 'weekly', 100, :t)"
                ),
                {"id": row_id, "u": tenant_a, "c": category_id, "t": created_at},
            )
            seeded.append((row_id, created_at))
    expected = [str(row_id) for row_id, _ in sorted(seeded, key=lambda r: (r[1], r[0]))]

    assert [i["id"] for i in (await client.get("/v1/budgets")).json()["items"]] == expected
    for page_size in (1, 2, 3, 4, 8, 9, 10):
        seen: list[str] = []
        cursor: str | None = None
        pages = 0
        while True:
            params: dict[str, str | int] = {"limit": page_size}
            if cursor:
                params["cursor"] = cursor
            page = (await client.get("/v1/budgets", params=params)).json()
            assert page["limit"] == page_size
            assert len(page["items"]) <= page_size
            seen.extend(item["id"] for item in page["items"])
            cursor = page["next_cursor"]
            pages += 1
            if cursor is None:
                break
        assert seen == expected, page_size
        assert pages == -(-len(expected) // page_size)


async def test_limit_bounds_and_cursor_validation(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)

    assert (await client.get("/v1/budgets")).json()["limit"] == 50
    assert (await client.get("/v1/budgets", params={"limit": 200})).status_code == 200
    for bad in (0, -1, 201, "abc"):
        response = await client.get("/v1/budgets", params={"limit": bad})
        assert response.status_code == 422
        assert response.json()["code"] == "validation_error"
    for bad_cursor in ("garbage", "", "a" * 600):
        response = await client.get("/v1/budgets", params={"cursor": bad_cursor})
        assert response.status_code == 400
        assert response.json()["code"] == "invalid_cursor"


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"limit_minor": None},
        {"is_archived": None},
        {"limit_minor": 0},
        {"limit_minor": 10**12 + 1},
        {"limit_minor": 1.5},
        {"category_id": str(new_uuid7())},
        {"period": "monthly"},
        {"currency": "GHS"},
        {"id": str(new_uuid7())},
        {"user_id": str(uuid4())},
        {"spent_minor": 1},
        {"status": "over_limit"},
        {"deleted_at": "2020-01-01T00:00:00Z"},
    ],
)
async def test_update_rejects_invalid_payloads(
    api_client: ApiClientFactory, tenant_a: UUID, payload: dict[str, object]
) -> None:
    client = await api_client(tenant_a, now=NOW)
    budget = await make_budget(client, await make_category(client))

    response = await client.patch(f"/v1/budgets/{budget['id']}", json=payload)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert (await client.get(f"/v1/budgets/{budget['id']}")).json() == budget


async def test_tenant_cannot_see_or_change_another_tenants_budgets(
    api_client: ApiClientFactory,
    as_tenant: TenantSessionFactory,
    tenant_a: UUID,
    tenant_b: UUID,
) -> None:
    client_a = await api_client(tenant_a, now=NOW)
    client_b = await api_client(tenant_b, now=NOW)
    mine = await make_budget(client_a, await make_category(client_a, "A food"))
    theirs = await make_budget(client_b, await make_category(client_b, "B food"))
    b_path = f"/v1/budgets/{theirs['id']}"

    listed = (await client_a.get("/v1/budgets", params={"include_archived": True})).json()["items"]
    assert [item["id"] for item in listed] == [mine["id"]]
    assert (await client_a.get(b_path)).status_code == 404
    patched = await client_a.patch(b_path, json={"limit_minor": 1})
    assert patched.status_code == 404
    assert (await client_a.delete(b_path)).status_code == 204
    still_there = await client_b.get(b_path)
    assert still_there.status_code == 200
    assert still_there.json() == theirs

    async def visible_ids(session: AsyncSession) -> list[UUID]:
        owner = await session.scalar(text("SELECT current_setting('app.user_id')::uuid"))
        rows = await session.scalars(select(Budget.id).where(Budget.user_id == owner))
        return list(rows.all())

    await assert_tenant_isolated(
        as_tenant,
        visible_ids,
        tenant_a,
        tenant_b,
        [UUID(mine["id"])],
        [UUID(theirs["id"])],
    )


async def test_spending_never_crosses_tenants(
    api_client: ApiClientFactory, tenant_a: UUID, tenant_b: UUID
) -> None:
    client_a = await api_client(tenant_a, now=NOW)
    client_b = await api_client(tenant_b, now=NOW)
    category_a = await make_category(client_a)
    category_b = await make_category(client_b)
    budget_a = await make_budget(client_a, category_a)
    await spend(client_b, await make_account(client_b), category_b, day(0), 5000)

    result = (await client_a.get(f"/v1/budgets/{budget_a['id']}")).json()

    assert (result["spent_minor"], result["status"]) == (0, "within")


async def test_creating_with_another_tenants_id_looks_like_any_other_id_conflict(
    api_client: ApiClientFactory, tenant_a: UUID, tenant_b: UUID
) -> None:
    client_a = await api_client(tenant_a, now=NOW)
    client_b = await api_client(tenant_b, now=NOW)
    category_a = await make_category(client_a, "A food")
    other_category_a = await make_category(client_a, "A fun")
    theirs = await make_budget(client_b, await make_category(client_b, "B food"))
    mine = await make_budget(client_a, category_a)

    foreign = await client_a.post("/v1/budgets", json=body(other_category_a, id=theirs["id"]))
    own_mismatch = await client_a.post(
        "/v1/budgets", json=body(category_a, id=mine["id"], limit_minor=1)
    )

    for response in (foreign, own_mismatch):
        assert response.status_code == 409
        assert response.json()["code"] == "id_conflict"
    assert foreign.json() == own_mismatch.json()
    assert (await client_b.get(f"/v1/budgets/{theirs['id']}")).json() == theirs


async def test_a_user_id_in_the_body_never_selects_the_owner(
    api_client: ApiClientFactory, tenant_a: UUID, tenant_b: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)

    response = await client.post(
        "/v1/budgets", json=body(await make_category(client), user_id=str(tenant_b))
    )

    assert response.status_code == 422
