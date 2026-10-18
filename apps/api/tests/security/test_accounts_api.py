"""HTTP behavior of /v1/accounts against real Postgres with RLS."""

from __future__ import annotations

import unicodedata
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from tests.conftest import make_settings
from tests.security.conftest import ApiClientFactory, TenantSessionFactory, assert_tenant_isolated

from largent.core.ids import new_uuid7
from largent.core.pagination import PageCursor, encode_cursor
from largent.modules.accounts.models import Account
from largent.modules.accounts.repository import get_account

OLD_KEY = "old-rotation-secret-key-32-bytes-0001"
NEW_KEY = "new-rotation-secret-key-32-bytes-0002"


def account_body(name: str = "Wallet", **extra: object) -> dict[str, object]:
    return {"name": name, "type": "cash", **extra}


async def test_create_read_update_list_and_soft_delete(
    api_client: ApiClientFactory,
    as_tenant: TenantSessionFactory,
    tenant_a: UUID,
) -> None:
    client = await api_client(tenant_a)
    account_id = new_uuid7()

    created = await client.post(
        "/v1/accounts",
        json={
            "id": str(account_id),
            "name": "MTN MoMo",
            "type": "mobile_money",
            "opening_balance_minor": 13_000,
            "position": 2,
        },
    )
    assert created.status_code == 201
    body = created.json()
    assert body["id"] == str(account_id)
    assert body["opening_balance_minor"] == 13_000
    assert body["currency"] == "GHS"
    assert body["is_archived"] is False
    assert set(body) == {
        "id",
        "name",
        "type",
        "opening_balance_minor",
        "currency",
        "is_archived",
        "position",
        "created_at",
        "updated_at",
    }

    assert (await client.get(f"/v1/accounts/{account_id}")).json() == body
    assert [item["id"] for item in (await client.get("/v1/accounts")).json()["items"]] == [
        str(account_id)
    ]

    updated = await client.patch(
        f"/v1/accounts/{account_id}", json={"name": "Main MoMo", "is_archived": True}
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Main MoMo"
    assert updated.json()["is_archived"] is True
    assert updated.json()["opening_balance_minor"] == 13_000
    assert updated.json()["created_at"] == body["created_at"]
    assert updated.json()["updated_at"] > body["updated_at"]
    assert (await client.get(f"/v1/accounts/{account_id}")).json() == updated.json()

    assert (await client.delete(f"/v1/accounts/{account_id}")).status_code == 204
    assert (await client.get(f"/v1/accounts/{account_id}")).status_code == 404
    assert (await client.patch(f"/v1/accounts/{account_id}", json={"name": "X"})).status_code == 404
    listed = await client.get("/v1/accounts", params={"include_archived": True})
    assert listed.json()["items"] == []

    async with as_tenant(tenant_a) as session:
        row = await get_account(session, tenant_a, account_id, include_deleted=True)
        assert row is not None
        assert row.deleted_at is not None
        assert row.name == "Main MoMo"


async def test_delete_is_idempotent_and_silent_for_unknown_ids(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a)
    created = await client.post("/v1/accounts", json=account_body())
    account_id = created.json()["id"]

    assert (await client.delete(f"/v1/accounts/{account_id}")).status_code == 204
    assert (await client.delete(f"/v1/accounts/{account_id}")).status_code == 204
    assert (await client.delete(f"/v1/accounts/{new_uuid7()}")).status_code == 204


async def test_server_assigns_a_uuid7_when_no_id_is_sent(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a)

    created = await client.post("/v1/accounts", json=account_body())

    assert created.status_code == 201
    assert UUID(created.json()["id"]).version == 7


@pytest.mark.parametrize(
    "payload",
    [
        {"name": "", "type": "cash"},
        {"name": "   ", "type": "cash"},
        {"name": "x" * 61, "type": "cash"},
        {"name": 5, "type": "cash"},
        {"name": None, "type": "cash"},
        {"type": "cash"},
        {"name": "A"},
        {"name": "A", "type": "crypto"},
        {"name": "A", "type": "CASH"},
        {"name": "A", "type": "cash", "opening_balance_minor": -1},
        {"name": "A", "type": "cash", "opening_balance_minor": 10**12 + 1},
        {"name": "A", "type": "cash", "opening_balance_minor": 1.5},
        {"name": "A", "type": "cash", "opening_balance_minor": 100.0},
        {"name": "A", "type": "cash", "opening_balance_minor": "100"},
        {"name": "A", "type": "cash", "opening_balance_minor": True},
        {"name": "A", "type": "cash", "currency": "USD"},
        {"name": "A", "type": "cash", "currency": "ghs"},
        {"name": "A", "type": "cash", "is_archived": "yes"},
        {"name": "A", "type": "cash", "position": -1},
        {"name": "A", "type": "cash", "position": 2**31},
        {"name": "A", "type": "cash", "id": "not-a-uuid"},
        {"name": "A", "type": "cash", "id": str(uuid4())},
        {"name": "A", "type": "cash", "id": str(UUID(int=0))},
        {"name": "A", "type": "cash", "user_id": str(uuid4())},
        {"name": "A", "type": "cash", "created_at": "2020-01-01T00:00:00Z"},
        {"name": "A", "type": "cash", "updated_at": "2020-01-01T00:00:00Z"},
        {"name": "A", "type": "cash", "deleted_at": None},
        {"name": "A", "type": "cash", "balance_minor": 5},
    ],
)
async def test_create_rejects_invalid_payloads(
    api_client: ApiClientFactory, tenant_a: UUID, payload: dict[str, object]
) -> None:
    client = await api_client(tenant_a)

    response = await client.post("/v1/accounts", json=payload)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert response.headers["content-type"] == "application/problem+json"
    assert (await client.get("/v1/accounts")).json()["items"] == []


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"name": None},
        {"name": ""},
        {"type": "bad"},
        {"opening_balance_minor": -5},
        {"opening_balance_minor": 10**12 + 1},
        {"is_archived": None},
        {"currency": "EUR"},
        {"id": str(new_uuid7())},
        {"user_id": str(uuid4())},
        {"updated_at": "2020-01-01T00:00:00Z"},
        {"deleted_at": "2020-01-01T00:00:00Z"},
    ],
)
async def test_update_rejects_invalid_payloads(
    api_client: ApiClientFactory, tenant_a: UUID, payload: dict[str, object]
) -> None:
    client = await api_client(tenant_a)
    account_id = (await client.post("/v1/accounts", json=account_body())).json()["id"]

    response = await client.patch(f"/v1/accounts/{account_id}", json=payload)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


async def test_amount_boundaries_are_accepted(api_client: ApiClientFactory, tenant_a: UUID) -> None:
    client = await api_client(tenant_a)

    zero = await client.post("/v1/accounts", json=account_body("Zero", opening_balance_minor=0))
    top = await client.post(
        "/v1/accounts", json=account_body("Top", opening_balance_minor=10**12, position=0)
    )

    assert zero.status_code == top.status_code == 201
    assert top.json()["opening_balance_minor"] == 10**12


async def test_names_are_nfc_normalized_and_trimmed(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a)
    decomposed = unicodedata.normalize("NFD", "Café")
    assert decomposed != "Café"

    created = await client.post("/v1/accounts", json=account_body(f"  {decomposed}\t\n"))

    assert created.json()["name"] == "Café"
    assert unicodedata.is_normalized("NFC", created.json()["name"])
    duplicate = await client.post("/v1/accounts", json=account_body("café"))
    assert duplicate.status_code == 409


async def test_length_limit_counts_normalized_characters(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a)

    exactly_60 = await client.post("/v1/accounts", json=account_body("é" * 60))
    decomposed_60 = await client.post(
        "/v1/accounts", json=account_body(unicodedata.normalize("NFD", "è" * 60))
    )

    assert exactly_60.status_code == 201
    assert decomposed_60.status_code == 201


async def test_duplicate_names_are_rejected_case_insensitively(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a)
    first = await client.post("/v1/accounts", json=account_body("Savings"))
    assert first.status_code == 201

    duplicate = await client.post("/v1/accounts", json=account_body("sAvInGs", type="bank"))
    other = await client.post("/v1/accounts", json=account_body("Spending"))
    rename = await client.patch(f"/v1/accounts/{other.json()['id']}", json={"name": "SAVINGS"})
    self_rename = await client.patch(f"/v1/accounts/{first.json()['id']}", json={"name": "SAVINGS"})

    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "duplicate_name"
    assert duplicate.headers["content-type"] == "application/problem+json"
    assert rename.status_code == 409
    assert rename.json()["code"] == "duplicate_name"
    assert self_rename.status_code == 200
    assert (await client.get(f"/v1/accounts/{other.json()['id']}")).json()["name"] == "Spending"


async def test_a_name_can_be_reused_after_soft_delete_and_by_other_tenants(
    api_client: ApiClientFactory, tenant_a: UUID, tenant_b: UUID
) -> None:
    client_a = await api_client(tenant_a)
    client_b = await api_client(tenant_b)
    first = await client_a.post("/v1/accounts", json=account_body("Wallet"))

    assert (await client_b.post("/v1/accounts", json=account_body("Wallet"))).status_code == 201
    assert (await client_a.delete(f"/v1/accounts/{first.json()['id']}")).status_code == 204
    again = await client_a.post("/v1/accounts", json=account_body("wallet"))

    assert again.status_code == 201
    assert again.json()["id"] != first.json()["id"]


async def test_create_is_idempotent_by_client_id(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a)
    account_id = new_uuid7()
    payload = {
        "id": str(account_id),
        "name": "Wallet",
        "type": "cash",
        "opening_balance_minor": 500,
    }

    created = await client.post("/v1/accounts", json=payload)
    replay = await client.post("/v1/accounts", json=payload)
    padded_replay = await client.post("/v1/accounts", json={**payload, "name": "  Wallet "})
    different_name = await client.post("/v1/accounts", json={**payload, "name": "Other"})
    different_amount = await client.post(
        "/v1/accounts", json={**payload, "opening_balance_minor": 501}
    )
    different_type = await client.post("/v1/accounts", json={**payload, "type": "bank"})

    assert created.status_code == 201
    assert replay.status_code == 200
    assert replay.json() == created.json()
    assert padded_replay.status_code == 200
    for conflict in (different_name, different_amount, different_type):
        assert conflict.status_code == 409
        assert conflict.json()["code"] == "id_conflict"
    assert len((await client.get("/v1/accounts")).json()["items"]) == 1


async def test_concurrent_identical_creates_yield_one_row(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    import asyncio

    client = await api_client(tenant_a)
    payload = {"id": str(new_uuid7()), "name": "Race", "type": "cash"}

    responses = await asyncio.gather(*(client.post("/v1/accounts", json=payload) for _ in range(5)))

    assert sorted(response.status_code for response in responses) == [200, 200, 200, 200, 201]
    assert len((await client.get("/v1/accounts")).json()["items"]) == 1


async def test_a_deleted_id_cannot_be_recreated(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a)
    payload = {"id": str(new_uuid7()), "name": "Gone", "type": "cash"}
    await client.post("/v1/accounts", json=payload)
    await client.delete(f"/v1/accounts/{payload['id']}")

    response = await client.post("/v1/accounts", json=payload)

    assert response.status_code == 409
    assert response.json()["code"] == "id_conflict"


async def test_archived_accounts_are_hidden_unless_requested(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a)
    active = (await client.post("/v1/accounts", json=account_body("Active"))).json()
    archived = (
        await client.post("/v1/accounts", json=account_body("Old", is_archived=True))
    ).json()
    deleted = (await client.post("/v1/accounts", json=account_body("Deleted"))).json()
    await client.delete(f"/v1/accounts/{deleted['id']}")

    default = await client.get("/v1/accounts")
    explicit_false = await client.get("/v1/accounts", params={"include_archived": "false"})
    everything = await client.get("/v1/accounts", params={"include_archived": "true"})

    assert [a["id"] for a in default.json()["items"]] == [active["id"]]
    assert [a["id"] for a in explicit_false.json()["items"]] == [active["id"]]
    assert {a["id"] for a in everything.json()["items"]} == {active["id"], archived["id"]}
    assert (await client.get(f"/v1/accounts/{archived['id']}")).status_code == 200


async def test_pagination_is_stable_and_complete(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a)
    positions = [3, 1, 2, 1, 0, 2, 3]
    for index, position in enumerate(positions):
        response = await client.post(
            "/v1/accounts", json=account_body(f"Account {index}", position=position)
        )
        assert response.status_code == 201

    everything = (await client.get("/v1/accounts", params={"limit": 200})).json()
    assert everything["next_cursor"] is None
    expected_ids = [item["id"] for item in everything["items"]]
    assert [item["position"] for item in everything["items"]] == sorted(positions)

    for page_size in (1, 2, 3, 7, 8):
        seen: list[str] = []
        cursor: str | None = None
        pages = 0
        while True:
            params: dict[str, str | int] = {"limit": page_size}
            if cursor:
                params["cursor"] = cursor
            page = (await client.get("/v1/accounts", params=params)).json()
            assert page["limit"] == page_size
            assert len(page["items"]) <= page_size
            seen.extend(item["id"] for item in page["items"])
            cursor = page["next_cursor"]
            pages += 1
            if cursor is None:
                break
        assert seen == expected_ids
        assert pages == -(-len(positions) // page_size)


async def test_a_page_that_ends_exactly_has_no_next_cursor(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a)
    for index in range(4):
        await client.post("/v1/accounts", json=account_body(f"Account {index}", position=index))

    page = (await client.get("/v1/accounts", params={"limit": 4})).json()

    assert len(page["items"]) == 4
    assert page["next_cursor"] is None


async def test_a_cursor_stays_valid_when_rows_change_between_pages(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a)
    ids = []
    for index in range(5):
        created = await client.post(
            "/v1/accounts", json=account_body(f"Account {index}", position=index)
        )
        ids.append(created.json()["id"])

    first = (await client.get("/v1/accounts", params={"limit": 2})).json()
    await client.delete(f"/v1/accounts/{ids[0]}")
    await client.delete(f"/v1/accounts/{ids[2]}")
    second = (
        await client.get("/v1/accounts", params={"limit": 2, "cursor": first["next_cursor"]})
    ).json()

    assert [item["id"] for item in second["items"]] == [ids[3], ids[4]]


async def test_limit_bounds_and_default(api_client: ApiClientFactory, tenant_a: UUID) -> None:
    client = await api_client(tenant_a)

    default = await client.get("/v1/accounts")
    assert default.json()["limit"] == 50
    assert (await client.get("/v1/accounts", params={"limit": 200})).status_code == 200
    assert (await client.get("/v1/accounts", params={"limit": 1})).status_code == 200
    for bad in (0, -1, 201, "abc"):
        response = await client.get("/v1/accounts", params={"limit": bad})
        assert response.status_code == 422
        assert response.json()["code"] == "validation_error"


async def test_invalid_cursors_return_400(api_client: ApiClientFactory, tenant_a: UUID) -> None:
    client = await api_client(tenant_a)
    for index in range(4):
        await client.post("/v1/accounts", json=account_body(f"Account {index}", position=index))
    valid = (await client.get("/v1/accounts", params={"limit": 2})).json()["next_cursor"]
    payload, signature = valid.split(".")
    forged_cursor = encode_cursor(
        PageCursor(0, datetime(2020, 1, 1, tzinfo=UTC), new_uuid7()), [b"x" * 32]
    )

    for bad in (
        valid + "x",
        valid[:-2],
        f"{signature}.{payload}",
        payload,
        "garbage",
        "!!.!!",
        "",
        "a" * 600,
        forged_cursor,
    ):
        response = await client.get("/v1/accounts", params={"cursor": bad})
        assert response.status_code == 400, bad
        assert response.json()["code"] == "invalid_cursor"
        assert response.headers["content-type"] == "application/problem+json"


async def test_a_cursor_signed_with_a_different_key_is_rejected(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    other_deployment = await api_client(
        tenant_a, settings=make_settings(cursor_signing_keys=[OLD_KEY])
    )
    client = await api_client(tenant_a, settings=make_settings(cursor_signing_keys=[NEW_KEY]))
    for index in range(3):
        await other_deployment.post(
            "/v1/accounts", json=account_body(f"Account {index}", position=index)
        )
    foreign = (await other_deployment.get("/v1/accounts", params={"limit": 1})).json()[
        "next_cursor"
    ]

    response = await client.get("/v1/accounts", params={"cursor": foreign})

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_cursor"


async def test_key_rotation_keeps_old_cursors_valid_while_the_old_key_is_listed(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    before = await api_client(tenant_a, settings=make_settings(cursor_signing_keys=[OLD_KEY]))
    during = await api_client(
        tenant_a, settings=make_settings(cursor_signing_keys=[NEW_KEY, OLD_KEY])
    )
    after = await api_client(tenant_a, settings=make_settings(cursor_signing_keys=[NEW_KEY]))
    for index in range(4):
        await before.post("/v1/accounts", json=account_body(f"Account {index}", position=index))
    old_cursor = (await before.get("/v1/accounts", params={"limit": 2})).json()["next_cursor"]

    accepted = await during.get("/v1/accounts", params={"limit": 2, "cursor": old_cursor})
    new_cursor = (await during.get("/v1/accounts", params={"limit": 1})).json()["next_cursor"]
    refused = await after.get("/v1/accounts", params={"cursor": old_cursor})
    accepted_after = await after.get("/v1/accounts", params={"cursor": new_cursor})

    assert accepted.status_code == 200
    assert [item["position"] for item in accepted.json()["items"]] == [2, 3]
    assert refused.status_code == 400
    assert accepted_after.status_code == 200
    assert (await before.get("/v1/accounts", params={"cursor": new_cursor})).status_code == 400


async def test_tenant_cannot_see_or_change_another_tenants_accounts(
    api_client: ApiClientFactory,
    as_tenant: TenantSessionFactory,
    tenant_a: UUID,
    tenant_b: UUID,
) -> None:
    client_a = await api_client(tenant_a)
    client_b = await api_client(tenant_b)
    account_a = (await client_a.post("/v1/accounts", json=account_body("A account"))).json()
    account_b = (await client_b.post("/v1/accounts", json=account_body("B account"))).json()
    b_id = account_b["id"]

    listed = (await client_a.get("/v1/accounts", params={"include_archived": True})).json()
    assert [item["id"] for item in listed["items"]] == [account_a["id"]]
    assert (await client_a.get(f"/v1/accounts/{b_id}")).status_code == 404
    patched = await client_a.patch(f"/v1/accounts/{b_id}", json={"name": "Hijacked"})
    assert patched.status_code == 404
    assert (await client_a.delete(f"/v1/accounts/{b_id}")).status_code == 204
    still_there = await client_b.get(f"/v1/accounts/{b_id}")
    assert still_there.status_code == 200
    assert still_there.json() == account_b

    async def visible_ids(session: AsyncSession) -> list[UUID]:
        owner = await session.scalar(text("SELECT current_setting('app.user_id')::uuid"))
        rows = await session.scalars(
            select(Account.id).where(Account.user_id == owner).order_by(Account.name)
        )
        return list(rows.all())

    await assert_tenant_isolated(
        as_tenant,
        visible_ids,
        tenant_a,
        tenant_b,
        [UUID(account_a["id"])],
        [UUID(account_b["id"])],
    )


async def test_creating_with_another_tenants_id_looks_like_any_other_id_conflict(
    api_client: ApiClientFactory, tenant_a: UUID, tenant_b: UUID
) -> None:
    client_a = await api_client(tenant_a)
    client_b = await api_client(tenant_b)
    b_id = (await client_b.post("/v1/accounts", json=account_body("B account"))).json()["id"]
    a_id = (await client_a.post("/v1/accounts", json=account_body("A account"))).json()["id"]

    foreign = await client_a.post("/v1/accounts", json=account_body("Forged", id=b_id))
    own_mismatch = await client_a.post("/v1/accounts", json=account_body("Forged", id=a_id))
    foreign_same_payload = await client_a.post(
        "/v1/accounts", json=account_body("B account", id=b_id)
    )

    for response in (foreign, own_mismatch, foreign_same_payload):
        assert response.status_code == 409
        assert response.json()["code"] == "id_conflict"
    assert foreign.json() == own_mismatch.json() == foreign_same_payload.json()
    assert (await client_b.get(f"/v1/accounts/{b_id}")).json()["name"] == "B account"
    assert [i["id"] for i in (await client_a.get("/v1/accounts")).json()["items"]] == [a_id]


async def test_a_user_id_in_the_body_never_selects_the_owner(
    api_client: ApiClientFactory, tenant_a: UUID, tenant_b: UUID
) -> None:
    client_a = await api_client(tenant_a)

    response = await client_a.post("/v1/accounts", json=account_body(user_id=str(tenant_b)))

    assert response.status_code == 422
