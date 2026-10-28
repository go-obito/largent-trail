"""HTTP behavior of /v1/transactions against real Postgres with RLS."""

from __future__ import annotations

import asyncio
from datetime import UTC, date, datetime, timedelta
from uuid import UUID, uuid4

import httpx
import pytest
import structlog.testing
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from tests.conftest import make_settings
from tests.fake_auth import FakeAuthProvider
from tests.security.conftest import ApiClientFactory, TenantSessionFactory, assert_tenant_isolated

from largent.core.clock import utc_now
from largent.core.ids import new_uuid7
from largent.core.pagination import PageCursor, encode_cursor
from largent.core.security import VerifiedIdentity
from largent.core.tenancy import SessionFactory
from largent.main import create_app
from largent.modules.transactions.models import Transaction
from largent.modules.transactions.repository import get_transaction

NOW = datetime(2026, 10, 18, 12, 0, tzinfo=UTC)
TODAY = date(2026, 10, 18)
NEW_KEY = "new-rotation-secret-key-32-bytes-0002"


def day(offset: int = 0) -> str:
    return (TODAY + timedelta(days=offset)).isoformat()


async def make_account(client: httpx.AsyncClient, name: str = "Wallet", **extra: object) -> str:
    response = await client.post("/v1/accounts", json={"name": name, "type": "cash", **extra})
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


async def make_category(
    client: httpx.AsyncClient, name: str = "Food", kind: str = "expense", **extra: object
) -> str:
    response = await client.post("/v1/categories", json={"name": name, "kind": kind, **extra})
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


def body(account_id: str, **extra: object) -> dict[str, object]:
    return {
        "account_id": account_id,
        "kind": "expense",
        "amount_minor": 1300,
        "occurred_on": day(),
        **extra,
    }


async def make_transaction(
    client: httpx.AsyncClient, account_id: str, **extra: object
) -> dict[str, object]:
    response = await client.post("/v1/transactions", json=body(account_id, **extra))
    assert response.status_code == 201, response.text
    result: dict[str, object] = response.json()
    return result


async def set_timezone(as_tenant: TenantSessionFactory, user_id: UUID, timezone: str) -> None:
    async with as_tenant(user_id) as session:
        await session.execute(
            text("UPDATE users SET timezone = :tz WHERE id = :id"), {"tz": timezone, "id": user_id}
        )


async def test_create_read_update_list_and_soft_delete(
    api_client: ApiClientFactory, as_tenant: TenantSessionFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)
    category_id = await make_category(client)
    transaction_id = new_uuid7()

    created = await client.post(
        "/v1/transactions",
        json=body(
            account_id,
            id=str(transaction_id),
            category_id=category_id,
            note="  Lunch at Osu ",
            occurred_on=day(-2),
        ),
    )

    assert created.status_code == 201
    result = created.json()
    assert result["id"] == str(transaction_id)
    assert result["account_id"] == account_id
    assert result["account_name"] == "Wallet"
    assert result["category_id"] == category_id
    assert result["category_name"] == "Food"
    assert result["kind"] == "expense"
    assert result["amount_minor"] == 1300
    assert result["currency"] == "GHS"
    assert result["occurred_on"] == day(-2)
    assert result["note"] == "Lunch at Osu"
    assert set(result) == {
        "id",
        "account_id",
        "account_name",
        "category_id",
        "category_name",
        "kind",
        "amount_minor",
        "currency",
        "occurred_on",
        "note",
        "created_at",
        "updated_at",
    }
    assert (await client.get(f"/v1/transactions/{transaction_id}")).json() == result
    assert [i["id"] for i in (await client.get("/v1/transactions")).json()["items"]] == [
        str(transaction_id)
    ]

    updated = await client.patch(
        f"/v1/transactions/{transaction_id}",
        json={"amount_minor": 2500, "note": None, "category_id": None},
    )
    assert updated.status_code == 200
    assert updated.json()["amount_minor"] == 2500
    assert updated.json()["note"] is None
    assert updated.json()["category_id"] is None
    assert updated.json()["occurred_on"] == day(-2)
    assert updated.json()["created_at"] == result["created_at"]
    assert updated.json()["updated_at"] > result["updated_at"]
    assert (await client.get(f"/v1/transactions/{transaction_id}")).json() == updated.json()

    assert (await client.delete(f"/v1/transactions/{transaction_id}")).status_code == 204
    assert (await client.get(f"/v1/transactions/{transaction_id}")).status_code == 404
    patched = await client.patch(f"/v1/transactions/{transaction_id}", json={"amount_minor": 1})
    assert patched.status_code == 404
    assert patched.json()["code"] == "not_found"
    assert (await client.get("/v1/transactions")).json()["items"] == []

    async with as_tenant(tenant_a) as session:
        row = await get_transaction(session, tenant_a, transaction_id, include_deleted=True)
        assert row is not None
        assert row.deleted_at is not None
        assert row.amount_minor == 2500


async def test_a_transaction_may_be_uncategorized_and_income(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)

    created = await client.post(
        "/v1/transactions", json=body(account_id, kind="income", amount_minor=500_000)
    )

    assert created.status_code == 201
    assert created.json()["category_id"] is None
    assert created.json()["kind"] == "income"
    assert UUID(created.json()["id"]).version == 7


async def test_delete_is_idempotent_and_silent_for_unknown_ids(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    transaction = await make_transaction(client, await make_account(client))

    assert (await client.delete(f"/v1/transactions/{transaction['id']}")).status_code == 204
    assert (await client.delete(f"/v1/transactions/{transaction['id']}")).status_code == 204
    assert (await client.delete(f"/v1/transactions/{new_uuid7()}")).status_code == 204


async def test_create_is_idempotent_by_client_id(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)
    other_account = await make_account(client, "Bank")
    category_id = await make_category(client)
    payload = body(account_id, id=str(new_uuid7()), category_id=category_id, note="Lunch")

    created = await client.post("/v1/transactions", json=payload)
    replay = await client.post("/v1/transactions", json=payload)
    padded_replay = await client.post("/v1/transactions", json={**payload, "note": "  Lunch "})
    conflicts = [
        await client.post("/v1/transactions", json={**payload, "amount_minor": 1301}),
        await client.post("/v1/transactions", json={**payload, "note": "Other"}),
        await client.post("/v1/transactions", json={**payload, "note": None}),
        await client.post("/v1/transactions", json={**payload, "occurred_on": day(-1)}),
        await client.post("/v1/transactions", json={**payload, "account_id": other_account}),
        await client.post("/v1/transactions", json={**payload, "category_id": None}),
        await client.post("/v1/transactions", json={**payload, "kind": "income"}),
    ]

    assert created.status_code == 201
    assert replay.status_code == 200
    assert replay.json() == created.json()
    assert padded_replay.status_code == 200
    for conflict in conflicts:
        assert conflict.status_code == 409
        assert conflict.json()["code"] == "id_conflict"
        assert conflict.headers["content-type"] == "application/problem+json"
    assert len((await client.get("/v1/transactions")).json()["items"]) == 1


async def test_a_replay_still_succeeds_after_the_account_is_archived(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)
    payload = body(account_id, id=str(new_uuid7()))
    await client.post("/v1/transactions", json=payload)
    await client.patch(f"/v1/accounts/{account_id}", json={"is_archived": True})

    replay = await client.post("/v1/transactions", json=payload)

    assert replay.status_code == 200


async def test_concurrent_identical_creates_yield_one_row(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    payload = body(await make_account(client), id=str(new_uuid7()))

    responses = await asyncio.gather(
        *(client.post("/v1/transactions", json=payload) for _ in range(5))
    )

    assert sorted(response.status_code for response in responses) == [200, 200, 200, 200, 201]
    assert len((await client.get("/v1/transactions")).json()["items"]) == 1


async def test_a_deleted_id_cannot_be_recreated(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    payload = body(await make_account(client), id=str(new_uuid7()))
    await client.post("/v1/transactions", json=payload)
    await client.delete(f"/v1/transactions/{payload['id']}")

    response = await client.post("/v1/transactions", json=payload)

    assert response.status_code == 409
    assert response.json()["code"] == "id_conflict"


@pytest.mark.parametrize(
    "overrides",
    [
        {"amount_minor": 0},
        {"amount_minor": -1},
        {"amount_minor": 10**12 + 1},
        {"amount_minor": 12.5},
        {"amount_minor": 100.0},
        {"amount_minor": "100"},
        {"amount_minor": True},
        {"amount_minor": None},
        {"kind": "transfer"},
        {"kind": "EXPENSE"},
        {"kind": None},
        {"currency": "USD"},
        {"currency": "ghs"},
        {"occurred_on": "2026-02-30"},
        {"occurred_on": "18/10/2026"},
        {"occurred_on": "2026-10-18T09:00:00Z"},
        {"occurred_on": 20261018},
        {"occurred_on": None},
        {"note": ""},
        {"note": "   "},
        {"note": "n" * 281},
        {"note": 5},
        {"id": "not-a-uuid"},
        {"id": str(uuid4())},
        {"account_id": "not-a-uuid"},
        {"account_id": None},
        {"category_id": "not-a-uuid"},
        {"user_id": str(uuid4())},
        {"created_at": "2020-01-01T00:00:00Z"},
        {"deleted_at": None},
        {"balance_minor": 5},
    ],
)
async def test_create_rejects_invalid_payloads(
    api_client: ApiClientFactory, tenant_a: UUID, overrides: dict[str, object]
) -> None:
    client = await api_client(tenant_a, now=NOW)
    payload = {**body(await make_account(client)), **overrides}

    response = await client.post("/v1/transactions", json=payload)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert response.headers["content-type"] == "application/problem+json"
    assert (await client.get("/v1/transactions")).json()["items"] == []


@pytest.mark.parametrize("missing", ["account_id", "kind", "amount_minor", "occurred_on"])
async def test_create_requires_the_mandatory_fields(
    api_client: ApiClientFactory, tenant_a: UUID, missing: str
) -> None:
    client = await api_client(tenant_a, now=NOW)
    payload = body(await make_account(client))
    del payload[missing]

    response = await client.post("/v1/transactions", json=payload)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


async def test_amount_and_note_boundaries_are_accepted(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)

    smallest = await client.post("/v1/transactions", json=body(account_id, amount_minor=1))
    largest = await client.post(
        "/v1/transactions", json=body(account_id, amount_minor=10**12, note="n" * 280)
    )

    assert smallest.status_code == largest.status_code == 201
    assert largest.json()["amount_minor"] == 10**12


async def test_unknown_missing_deleted_and_foreign_references_are_one_error(
    api_client: ApiClientFactory, tenant_a: UUID, tenant_b: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    client_b = await api_client(tenant_b, now=NOW)
    account_id = await make_account(client)
    deleted_account = await make_account(client, "Closed")
    await client.delete(f"/v1/accounts/{deleted_account}")
    deleted_category = await make_category(client, "Gone")
    await client.delete(f"/v1/categories/{deleted_category}")
    foreign_account = await make_account(client_b, "B wallet")
    foreign_category = await make_category(client_b, "B food")

    account_failures = [
        await client.post("/v1/transactions", json=body(str(new_uuid7()))),
        await client.post("/v1/transactions", json=body(foreign_account)),
        await client.post("/v1/transactions", json=body(deleted_account)),
    ]
    category_failures = [
        await client.post("/v1/transactions", json=body(account_id, category_id=str(new_uuid7()))),
        await client.post("/v1/transactions", json=body(account_id, category_id=foreign_category)),
        await client.post("/v1/transactions", json=body(account_id, category_id=deleted_category)),
    ]

    for responses, field in ((account_failures, "account_id"), (category_failures, "category_id")):
        for response in responses:
            assert response.status_code == 422
            assert response.json()["code"] == "invalid_reference"
            assert response.json()["field"] == field
            assert response.headers["content-type"] == "application/problem+json"
        assert responses[0].json() == responses[1].json() == responses[2].json()
    assert (await client.get("/v1/transactions")).json()["items"] == []
    assert (await client_b.get("/v1/transactions")).json()["items"] == []


async def test_archived_parents_cannot_take_new_transactions(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    archived_account = await make_account(client, "Old", is_archived=True)
    archived_category = await make_category(client, "Old", is_archived=True)
    account_id = await make_account(client)

    on_account = await client.post("/v1/transactions", json=body(archived_account))
    on_category = await client.post(
        "/v1/transactions", json=body(account_id, category_id=archived_category)
    )

    assert on_account.status_code == on_category.status_code == 422
    assert on_account.json()["code"] == "archived_reference"
    assert on_account.json()["field"] == "account_id"
    assert on_category.json()["code"] == "archived_reference"
    assert on_category.json()["field"] == "category_id"
    assert (await client.get("/v1/transactions")).json()["items"] == []


async def test_existing_transactions_are_untouched_when_their_parents_are_archived(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)
    category_id = await make_category(client)
    transaction = await make_transaction(client, account_id, category_id=category_id)
    await client.patch(f"/v1/accounts/{account_id}", json={"is_archived": True})
    await client.patch(f"/v1/categories/{category_id}", json={"is_archived": True})

    listed = (await client.get("/v1/transactions")).json()["items"]
    edited = await client.patch(
        f"/v1/transactions/{transaction['id']}",
        json={"amount_minor": 999, "note": "still editable", "occurred_on": day(-1)},
    )
    same_account = await client.patch(
        f"/v1/transactions/{transaction['id']}",
        json={"account_id": account_id, "category_id": category_id},
    )

    assert [item["id"] for item in listed] == [transaction["id"]]
    assert edited.status_code == 200
    assert edited.json()["amount_minor"] == 999
    assert same_account.status_code == 200
    assert same_account.json()["account_id"] == account_id


@pytest.mark.parametrize(
    ("category_kind", "transaction_kind"), [("income", "expense"), ("expense", "income")]
)
async def test_the_category_kind_must_match_the_transaction_kind(
    api_client: ApiClientFactory, tenant_a: UUID, category_kind: str, transaction_kind: str
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)
    category_id = await make_category(client, "Mixed", category_kind)

    response = await client.post(
        "/v1/transactions", json=body(account_id, category_id=category_id, kind=transaction_kind)
    )

    assert response.status_code == 422
    assert response.json()["code"] == "kind_mismatch"
    assert response.json()["field"] == "category_id"
    assert (await client.get("/v1/transactions")).json()["items"] == []


async def test_date_bounds(api_client: ApiClientFactory, tenant_a: UUID) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)

    for accepted in ("2000-01-01", day(), day(1)):
        response = await client.post(
            "/v1/transactions", json=body(account_id, occurred_on=accepted)
        )
        assert response.status_code == 201, accepted
    for rejected in ("1999-12-31", "0001-01-01", day(2), "9999-12-31"):
        response = await client.post(
            "/v1/transactions", json=body(account_id, occurred_on=rejected)
        )
        assert response.status_code == 422, rejected
        assert response.json()["code"] == "invalid_date"
        assert response.json()["field"] == "occurred_on"


async def test_the_latest_allowed_date_follows_the_users_timezone(
    api_client: ApiClientFactory, as_tenant: TenantSessionFactory, tenant_a: UUID, tenant_b: UUID
) -> None:
    # At 2026-10-18 12:00 UTC it is the 19th in Kiritimati (UTC+14) but the 18th in Pago Pago.
    await set_timezone(as_tenant, tenant_a, "Pacific/Kiritimati")
    await set_timezone(as_tenant, tenant_b, "Pacific/Pago_Pago")
    east = await api_client(tenant_a, now=NOW)
    west = await api_client(tenant_b, now=NOW)
    east_account = await make_account(east)
    west_account = await make_account(west)

    east_limit = await east.post("/v1/transactions", json=body(east_account, occurred_on=day(2)))
    east_over = await east.post("/v1/transactions", json=body(east_account, occurred_on=day(3)))
    west_limit = await west.post("/v1/transactions", json=body(west_account, occurred_on=day(1)))
    west_over = await west.post("/v1/transactions", json=body(west_account, occurred_on=day(2)))

    assert east_limit.status_code == 201
    assert east_over.status_code == 422
    assert west_limit.status_code == 201
    assert west_over.status_code == 422
    assert west_over.json()["code"] == east_over.json()["code"] == "invalid_date"


async def test_the_default_timezone_is_africa_accra(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    late_evening = datetime(2026, 10, 18, 23, 30, tzinfo=UTC)
    client = await api_client(tenant_a, now=late_evening)
    account_id = await make_account(client)

    allowed = await client.post("/v1/transactions", json=body(account_id, occurred_on=day(1)))
    refused = await client.post("/v1/transactions", json=body(account_id, occurred_on=day(2)))

    assert allowed.status_code == 201
    assert refused.status_code == 422


async def test_patch_merges_changes_and_keeps_unrelated_fields(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)
    category_id = await make_category(client)
    transaction = await make_transaction(client, account_id, category_id=category_id, note="Keep")

    moved = await client.patch(
        f"/v1/transactions/{transaction['id']}", json={"occurred_on": day(-30)}
    )
    other_account = await make_account(client, "Bank")
    rehomed = await client.patch(
        f"/v1/transactions/{transaction['id']}", json={"account_id": other_account}
    )

    assert moved.json()["occurred_on"] == day(-30)
    assert moved.json()["category_id"] == category_id
    assert moved.json()["note"] == "Keep"
    assert rehomed.json()["account_id"] == other_account
    assert rehomed.json()["occurred_on"] == day(-30)
    assert rehomed.json()["amount_minor"] == 1300


async def test_patch_revalidates_references_and_dates(
    api_client: ApiClientFactory, tenant_a: UUID, tenant_b: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    client_b = await api_client(tenant_b, now=NOW)
    account_id = await make_account(client)
    transaction = await make_transaction(client, account_id)
    path = f"/v1/transactions/{transaction['id']}"
    archived_account = await make_account(client, "Old", is_archived=True)
    archived_category = await make_category(client, "Old", is_archived=True)
    income_category = await make_category(client, "Pay", "income")
    foreign_account = await make_account(client_b, "B")
    foreign_category = await make_category(client_b, "B food")

    attempts = {
        "unknown account": ({"account_id": str(new_uuid7())}, "invalid_reference"),
        "foreign account": ({"account_id": foreign_account}, "invalid_reference"),
        "archived account": ({"account_id": archived_account}, "archived_reference"),
        "unknown category": ({"category_id": str(new_uuid7())}, "invalid_reference"),
        "foreign category": ({"category_id": foreign_category}, "invalid_reference"),
        "archived category": ({"category_id": archived_category}, "archived_reference"),
        "wrong-kind category": ({"category_id": income_category}, "kind_mismatch"),
        "too late": ({"occurred_on": day(2)}, "invalid_date"),
        "too early": ({"occurred_on": "1999-12-31"}, "invalid_date"),
    }
    for name, (payload, code) in attempts.items():
        response = await client.patch(path, json=payload)
        assert response.status_code == 422, name
        assert response.json()["code"] == code, name

    assert (await client.get(path)).json() == transaction


async def test_changing_the_kind_needs_a_compatible_category(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)
    expense_category = await make_category(client, "Food", "expense")
    income_category = await make_category(client, "Pay", "income")
    categorized = await make_transaction(client, account_id, category_id=expense_category)
    uncategorized = await make_transaction(client, account_id)

    alone = await client.patch(f"/v1/transactions/{categorized['id']}", json={"kind": "income"})
    same_category = await client.patch(
        f"/v1/transactions/{categorized['id']}",
        json={"kind": "income", "category_id": expense_category},
    )
    switched = await client.patch(
        f"/v1/transactions/{categorized['id']}",
        json={"kind": "income", "category_id": income_category},
    )
    cleared = await client.patch(
        f"/v1/transactions/{switched.json()['id']}", json={"kind": "expense", "category_id": None}
    )
    free_switch = await client.patch(
        f"/v1/transactions/{uncategorized['id']}", json={"kind": "income"}
    )
    category_only = await client.patch(
        f"/v1/transactions/{free_switch.json()['id']}", json={"category_id": expense_category}
    )

    assert alone.status_code == 422
    assert alone.json()["code"] == "kind_mismatch"
    assert same_category.status_code == 422
    assert same_category.json()["code"] == "kind_mismatch"
    assert switched.status_code == 200
    assert (switched.json()["kind"], switched.json()["category_id"]) == ("income", income_category)
    assert cleared.status_code == 200
    assert (cleared.json()["kind"], cleared.json()["category_id"]) == ("expense", None)
    assert free_switch.status_code == 200
    assert free_switch.json()["kind"] == "income"
    assert category_only.status_code == 422
    assert category_only.json()["code"] == "kind_mismatch"


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"account_id": None},
        {"kind": None},
        {"amount_minor": None},
        {"amount_minor": 0},
        {"amount_minor": 10**12 + 1},
        {"amount_minor": 1.5},
        {"occurred_on": None},
        {"occurred_on": "nope"},
        {"note": ""},
        {"note": "n" * 281},
        {"currency": "GHS"},
        {"currency": "USD"},
        {"id": str(new_uuid7())},
        {"user_id": str(uuid4())},
        {"created_at": "2020-01-01T00:00:00Z"},
        {"updated_at": "2020-01-01T00:00:00Z"},
        {"deleted_at": "2020-01-01T00:00:00Z"},
    ],
)
async def test_update_rejects_invalid_payloads(
    api_client: ApiClientFactory, tenant_a: UUID, payload: dict[str, object]
) -> None:
    client = await api_client(tenant_a, now=NOW)
    transaction = await make_transaction(client, await make_account(client))

    response = await client.patch(f"/v1/transactions/{transaction['id']}", json=payload)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert (await client.get(f"/v1/transactions/{transaction['id']}")).json() == transaction


async def test_list_filters(api_client: ApiClientFactory, tenant_a: UUID) -> None:
    client = await api_client(tenant_a, now=NOW)
    wallet = await make_account(client, "Wallet")
    bank = await make_account(client, "Bank")
    food = await make_category(client, "Food")
    pay = await make_category(client, "Pay", "income")
    rows = {
        "a": await make_transaction(client, wallet, occurred_on=day(-10), category_id=food),
        "b": await make_transaction(client, wallet, occurred_on=day(-5)),
        "c": await make_transaction(
            client, bank, occurred_on=day(-5), kind="income", category_id=pay
        ),
        "d": await make_transaction(client, bank, occurred_on=day(0), category_id=food),
        "e": await make_transaction(client, wallet, occurred_on=day(-1), kind="income"),
    }
    deleted = await make_transaction(client, wallet, occurred_on=day(-5))
    await client.delete(f"/v1/transactions/{deleted['id']}")

    async def ids(**params: str) -> set[str]:
        response = await client.get("/v1/transactions", params=params)
        assert response.status_code == 200, response.text
        return {item["id"] for item in response.json()["items"]}

    def named(*keys: str) -> set[str]:
        return {str(rows[key]["id"]) for key in keys}

    assert await ids() == named("a", "b", "c", "d", "e")
    assert await ids(**{"from": day(-5)}) == named("b", "c", "d", "e")
    assert await ids(to=day(-5)) == named("a", "b", "c")
    assert await ids(**{"from": day(-5), "to": day(-5)}) == named("b", "c")
    assert await ids(**{"from": day(1)}) == set()
    assert await ids(account_id=wallet) == named("a", "b", "e")
    assert await ids(category_id=food) == named("a", "d")
    assert await ids(kind="income") == named("c", "e")
    assert await ids(kind="expense", account_id=wallet) == named("a", "b")
    assert await ids(category_id=pay, account_id=bank, **{"from": day(-5)}) == named("c")
    assert await ids(account_id=str(new_uuid7())) == set()


@pytest.mark.parametrize(
    "params",
    [
        {"from": "2026-13-01"},
        {"to": "yesterday"},
        {"kind": "transfer"},
        {"account_id": "nope"},
        {"category_id": "nope"},
    ],
)
async def test_list_rejects_invalid_filters(
    api_client: ApiClientFactory, tenant_a: UUID, params: dict[str, str]
) -> None:
    client = await api_client(tenant_a, now=NOW)

    response = await client.get("/v1/transactions", params=params)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


async def test_list_is_ordered_newest_date_first(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)
    first = await make_transaction(client, account_id, occurred_on=day(-3))
    second = await make_transaction(client, account_id, occurred_on=day(-1))
    third = await make_transaction(client, account_id, occurred_on=day(-3))
    fourth = await make_transaction(client, account_id, occurred_on=day(0))

    listed = (await client.get("/v1/transactions")).json()["items"]

    assert [item["id"] for item in listed] == [
        fourth["id"],
        second["id"],
        third["id"],
        first["id"],
    ]


async def test_pagination_is_stable_across_rows_that_share_a_date_and_timestamp(
    api_client: ApiClientFactory, as_tenant: TenantSessionFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = UUID(await make_account(client))
    stamp = datetime(2026, 10, 1, 8, 0, 0, 123456, tzinfo=UTC)
    seeded = [
        (new_uuid7(), TODAY - timedelta(days=offset), stamp + timedelta(seconds=tick))
        for offset, tick in [(0, 0), (0, 0), (0, 0), (0, 1), (1, 0), (1, 0), (1, 0), (2, 5), (2, 5)]
    ]
    async with as_tenant(tenant_a) as session:
        for row_id, occurred_on, created_at in seeded:
            await session.execute(
                text(
                    "INSERT INTO transactions (id, user_id, account_id, kind, amount_minor, "
                    "occurred_on, created_at) VALUES (:id, :u, :a, 'expense', 100, :d, :c)"
                ),
                {"id": row_id, "u": tenant_a, "a": account_id, "d": occurred_on, "c": created_at},
            )
    expected = [
        str(row_id)
        for row_id, _, _ in sorted(seeded, key=lambda r: (r[1], r[2], r[0]), reverse=True)
    ]

    assert [i["id"] for i in (await client.get("/v1/transactions")).json()["items"]] == expected
    for page_size in (1, 2, 3, 4, 8, 9, 10):
        seen: list[str] = []
        cursor: str | None = None
        pages = 0
        while True:
            params: dict[str, str | int] = {"limit": page_size}
            if cursor:
                params["cursor"] = cursor
            page = (await client.get("/v1/transactions", params=params)).json()
            assert page["limit"] == page_size
            assert len(page["items"]) <= page_size
            seen.extend(item["id"] for item in page["items"])
            cursor = page["next_cursor"]
            pages += 1
            if cursor is None:
                break
        assert seen == expected, page_size
        assert pages == -(-len(expected) // page_size)


async def test_pagination_respects_filters_and_changes_between_pages(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)
    ids = [
        (await make_transaction(client, account_id, occurred_on=day(-i)))["id"] for i in range(6)
    ]
    await make_transaction(client, account_id, occurred_on=day(-9), kind="income")

    first = (await client.get("/v1/transactions", params={"limit": 2, "kind": "expense"})).json()
    await client.delete(f"/v1/transactions/{ids[0]}")
    await client.delete(f"/v1/transactions/{ids[2]}")
    second = (
        await client.get(
            "/v1/transactions",
            params={"limit": 2, "kind": "expense", "cursor": first["next_cursor"]},
        )
    ).json()

    assert [item["id"] for item in first["items"]] == ids[:2]
    assert [item["id"] for item in second["items"]] == [ids[3], ids[4]]


async def test_a_page_that_ends_exactly_has_no_next_cursor(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)
    for index in range(4):
        await make_transaction(client, account_id, occurred_on=day(-index))

    page = (await client.get("/v1/transactions", params={"limit": 4})).json()

    assert len(page["items"]) == 4
    assert page["next_cursor"] is None


async def test_limit_bounds_and_default(api_client: ApiClientFactory, tenant_a: UUID) -> None:
    client = await api_client(tenant_a, now=NOW)

    assert (await client.get("/v1/transactions")).json()["limit"] == 50
    assert (await client.get("/v1/transactions", params={"limit": 200})).status_code == 200
    assert (await client.get("/v1/transactions", params={"limit": 1})).status_code == 200
    for bad in (0, -1, 201, "abc"):
        response = await client.get("/v1/transactions", params={"limit": bad})
        assert response.status_code == 422
        assert response.json()["code"] == "validation_error"


async def test_invalid_cursors_return_400(api_client: ApiClientFactory, tenant_a: UUID) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)
    for index in range(4):
        await make_transaction(client, account_id, occurred_on=day(-index))
    valid = (await client.get("/v1/transactions", params={"limit": 2})).json()["next_cursor"]
    payload, signature = valid.split(".")
    undated = encode_cursor(
        PageCursor(0, datetime(2020, 1, 1, tzinfo=UTC), new_uuid7()), [NEW_KEY.encode()]
    )
    foreign_key = encode_cursor(
        PageCursor(0, datetime(2020, 1, 1, tzinfo=UTC), new_uuid7(), date(2020, 1, 1)),
        [b"x" * 32],
    )

    for bad in (
        valid + "x",
        valid[:-2],
        f"{signature}.{payload}",
        payload,
        "garbage",
        "",
        "a" * 600,
        foreign_key,
        undated,
    ):
        response = await client.get("/v1/transactions", params={"cursor": bad})
        assert response.status_code == 400, bad
        assert response.json()["code"] == "invalid_cursor"


async def test_a_transactions_cursor_is_not_accepted_by_other_lists(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)
    for index in range(3):
        await make_transaction(client, account_id, occurred_on=day(-index))
    cursor = (await client.get("/v1/transactions", params={"limit": 1})).json()["next_cursor"]

    response = await client.get("/v1/accounts", params={"cursor": cursor})

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_cursor"


async def test_tenant_cannot_see_or_change_another_tenants_transactions(
    api_client: ApiClientFactory,
    as_tenant: TenantSessionFactory,
    tenant_a: UUID,
    tenant_b: UUID,
) -> None:
    client_a = await api_client(tenant_a, now=NOW)
    client_b = await api_client(tenant_b, now=NOW)
    mine = await make_transaction(client_a, await make_account(client_a, "A wallet"))
    theirs = await make_transaction(client_b, await make_account(client_b, "B wallet"))
    b_path = f"/v1/transactions/{theirs['id']}"

    listed = (await client_a.get("/v1/transactions")).json()["items"]
    assert [item["id"] for item in listed] == [mine["id"]]
    assert (await client_a.get(b_path)).status_code == 404
    patched = await client_a.patch(b_path, json={"amount_minor": 1})
    assert patched.status_code == 404
    assert (await client_a.delete(b_path)).status_code == 204
    still_there = await client_b.get(b_path)
    assert still_there.status_code == 200
    assert still_there.json() == theirs

    async def visible_ids(session: AsyncSession) -> list[UUID]:
        owner = await session.scalar(text("SELECT current_setting('app.user_id')::uuid"))
        rows = await session.scalars(select(Transaction.id).where(Transaction.user_id == owner))
        return list(rows.all())

    await assert_tenant_isolated(
        as_tenant,
        visible_ids,
        tenant_a,
        tenant_b,
        [UUID(str(mine["id"]))],
        [UUID(str(theirs["id"]))],
    )


async def test_filters_cannot_reach_another_tenants_rows(
    api_client: ApiClientFactory, tenant_a: UUID, tenant_b: UUID
) -> None:
    client_a = await api_client(tenant_a, now=NOW)
    client_b = await api_client(tenant_b, now=NOW)
    b_account = await make_account(client_b, "B wallet")
    b_category = await make_category(client_b, "B food")
    await make_transaction(client_b, b_account, category_id=b_category)

    by_account = await client_a.get("/v1/transactions", params={"account_id": b_account})
    by_category = await client_a.get("/v1/transactions", params={"category_id": b_category})

    assert by_account.json()["items"] == []
    assert by_category.json()["items"] == []


async def test_creating_with_another_tenants_id_looks_like_any_other_id_conflict(
    api_client: ApiClientFactory, tenant_a: UUID, tenant_b: UUID
) -> None:
    client_a = await api_client(tenant_a, now=NOW)
    client_b = await api_client(tenant_b, now=NOW)
    account_a = await make_account(client_a, "A wallet")
    theirs = await make_transaction(client_b, await make_account(client_b, "B wallet"))
    mine = await make_transaction(client_a, account_a)

    foreign = await client_a.post("/v1/transactions", json=body(account_a, id=theirs["id"]))
    own_mismatch = await client_a.post(
        "/v1/transactions", json=body(account_a, id=mine["id"], amount_minor=1)
    )

    for response in (foreign, own_mismatch):
        assert response.status_code == 409
        assert response.json()["code"] == "id_conflict"
    assert foreign.json() == own_mismatch.json()
    assert (await client_b.get(f"/v1/transactions/{theirs['id']}")).json() == theirs


async def test_a_user_id_in_the_body_never_selects_the_owner(
    api_client: ApiClientFactory, tenant_a: UUID, tenant_b: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)

    response = await client.post("/v1/transactions", json=body(account_id, user_id=str(tenant_b)))

    assert response.status_code == 422


async def test_notes_and_amounts_are_never_logged(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)
    landlord_memo = "private-note-for-the-landlord"

    with structlog.testing.capture_logs() as logs:
        created = await client.post(
            "/v1/transactions", json=body(account_id, note=landlord_memo, amount_minor=987_654)
        )
        await client.get("/v1/transactions")
        await client.patch(
            f"/v1/transactions/{created.json()['id']}", json={"note": landlord_memo + "2"}
        )

    rendered = repr(logs)
    assert landlord_memo not in rendered
    assert "987654" not in rendered


async def test_scripted_walkthrough_with_bearer_tokens(
    app_session_factory: SessionFactory, seeded_tenants: None
) -> None:
    app = create_app(make_settings())
    app.state.session_factory = app_session_factory
    await app.state.auth_provider.aclose()
    app.state.auth_provider = FakeAuthProvider(
        {"walkthrough-token": VerifiedIdentity("test", "walkthrough-user")}
    )
    app.dependency_overrides[utc_now] = lambda: NOW
    headers = {"Authorization": "Bearer walkthrough-token"}
    transaction_id = str(new_uuid7())

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test", headers=headers
    ) as client:
        account = await client.post("/v1/accounts", json={"name": "MoMo", "type": "mobile_money"})
        payload = body(account.json()["id"], id=transaction_id, note="Waakye", occurred_on=day(-1))
        created = await client.post("/v1/transactions", json=payload)
        replayed = await client.post("/v1/transactions", json=payload)
        in_range = await client.get("/v1/transactions", params={"from": day(-2), "to": day(0)})
        edited = await client.patch(
            f"/v1/transactions/{transaction_id}", json={"amount_minor": 1500}
        )
        deleted = await client.delete(f"/v1/transactions/{transaction_id}")
        after = await client.get("/v1/transactions", params={"from": day(-2), "to": day(0)})
        anonymous = await client.get("/v1/transactions", headers={"Authorization": "Bearer nope"})

    await app.state.engine.dispose()
    await app.state.redis.aclose()
    assert (created.status_code, replayed.status_code) == (201, 200)
    assert replayed.json() == created.json()
    assert [item["id"] for item in in_range.json()["items"]] == [transaction_id]
    assert (edited.status_code, edited.json()["amount_minor"]) == (200, 1500)
    assert deleted.status_code == 204
    assert after.json()["items"] == []
    assert anonymous.status_code == 401


async def balance_of(client: httpx.AsyncClient, account_id: str) -> int:
    response = await client.get(f"/v1/accounts/{account_id}")
    assert response.status_code == 200, response.text
    return int(response.json()["balance_minor"])


async def test_a_new_account_balance_is_its_opening_balance(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)

    created = await client.post(
        "/v1/accounts", json={"name": "Wallet", "type": "cash", "opening_balance_minor": 5000}
    )

    assert created.status_code == 201
    assert created.json()["balance_minor"] == 5000


async def test_the_balance_is_opening_plus_income_minus_expenses(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client, opening_balance_minor=10_000)
    await make_transaction(client, account_id, kind="income", amount_minor=2_500)
    await make_transaction(client, account_id, kind="expense", amount_minor=1_300)
    await make_transaction(client, account_id, kind="expense", amount_minor=200)

    assert await balance_of(client, account_id) == 11_000


async def test_the_balance_can_be_negative(api_client: ApiClientFactory, tenant_a: UUID) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client, opening_balance_minor=100)
    await make_transaction(client, account_id, kind="expense", amount_minor=1_300)

    assert await balance_of(client, account_id) == -1_200


async def test_the_balance_follows_edits_and_deletes_of_transactions(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client, opening_balance_minor=1_000)
    first = await make_transaction(client, account_id, kind="expense", amount_minor=300)
    second = await make_transaction(client, account_id, kind="income", amount_minor=500)
    assert await balance_of(client, account_id) == 1_200

    await client.patch(f"/v1/transactions/{first['id']}", json={"amount_minor": 100})
    assert await balance_of(client, account_id) == 1_400
    await client.patch(f"/v1/accounts/{account_id}", json={"opening_balance_minor": 0})
    assert await balance_of(client, account_id) == 400
    await client.delete(f"/v1/transactions/{second['id']}")
    assert await balance_of(client, account_id) == -100


async def test_moving_a_transaction_moves_its_balance_effect(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    source = await make_account(client, "Source")
    target = await make_account(client, "Target")
    transaction = await make_transaction(client, source, kind="income", amount_minor=700)

    moved = await client.patch(f"/v1/transactions/{transaction['id']}", json={"account_id": target})

    assert moved.status_code == 200
    assert await balance_of(client, source) == 0
    assert await balance_of(client, target) == 700


async def test_list_returns_each_accounts_own_balance(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    busy = await make_account(client, "Busy", position=0, opening_balance_minor=50)
    idle = await make_account(client, "Idle", position=1, opening_balance_minor=75)
    await make_transaction(client, busy, kind="income", amount_minor=1_000)

    items = (await client.get("/v1/accounts")).json()["items"]

    assert [(item["id"], item["balance_minor"]) for item in items] == [(busy, 1_050), (idle, 75)]


async def test_an_archived_account_keeps_its_balance(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)
    await make_transaction(client, account_id, kind="income", amount_minor=900)

    archived = await client.patch(f"/v1/accounts/{account_id}", json={"is_archived": True})

    assert archived.json()["balance_minor"] == 900


async def test_an_idempotent_replay_reports_the_current_balance(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    payload = {"id": str(new_uuid7()), "name": "Wallet", "type": "cash"}
    created = await client.post("/v1/accounts", json=payload)
    await make_transaction(client, payload["id"], kind="income", amount_minor=400)

    replayed = await client.post("/v1/accounts", json=payload)

    assert (created.status_code, replayed.status_code) == (201, 200)
    assert replayed.json()["balance_minor"] == 400


async def test_other_tenants_transactions_never_affect_a_balance(
    api_client: ApiClientFactory, tenant_a: UUID, tenant_b: UUID
) -> None:
    client_a = await api_client(tenant_a, now=NOW)
    client_b = await api_client(tenant_b, now=NOW)
    mine = await make_account(client_a, "A wallet")
    theirs = await make_account(client_b, "B wallet")
    await make_transaction(client_b, theirs, kind="income", amount_minor=9_999)
    await make_transaction(client_a, mine, kind="income", amount_minor=100)

    assert await balance_of(client_a, mine) == 100
    assert (await client_a.get(f"/v1/accounts/{theirs}")).status_code == 404
    assert await balance_of(client_b, theirs) == 9_999


async def test_deleting_an_account_leaves_its_transactions_intact(
    api_client: ApiClientFactory, as_tenant: TenantSessionFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)
    transaction = await make_transaction(client, account_id, kind="income", amount_minor=800)

    deleted = await client.delete(f"/v1/accounts/{account_id}")

    assert deleted.status_code == 204
    assert (await client.get(f"/v1/accounts/{account_id}")).status_code == 404
    assert (await client.get(f"/v1/transactions/{transaction['id']}")).json() == transaction
    assert [i["id"] for i in (await client.get("/v1/transactions")).json()["items"]] == [
        transaction["id"]
    ]
    new = await client.post("/v1/transactions", json=body(account_id))
    assert new.status_code == 422
    assert new.json()["code"] == "invalid_reference"
    async with as_tenant(tenant_a) as session:
        row = await get_transaction(session, tenant_a, UUID(str(transaction["id"])))
        assert row is not None
        assert row.deleted_at is None


async def test_deleting_a_category_leaves_its_transactions_intact(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a, now=NOW)
    account_id = await make_account(client)
    category_id = await make_category(client)
    transaction = await make_transaction(client, account_id, category_id=category_id)

    deleted = await client.delete(f"/v1/categories/{category_id}")

    assert deleted.status_code == 204
    assert (await client.get(f"/v1/transactions/{transaction['id']}")).json() == transaction
    assert await balance_of(client, account_id) == -1_300
