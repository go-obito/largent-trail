"""HTTP behavior of /v1/categories against real Postgres with RLS."""

from __future__ import annotations

import asyncio
import unicodedata
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from tests.conftest import make_settings
from tests.security.conftest import ApiClientFactory, TenantSessionFactory, assert_tenant_isolated

from largent.core.ids import new_uuid7
from largent.modules.categories.models import Category
from largent.modules.categories.repository import get_category

OLD_KEY = "old-rotation-secret-key-32-bytes-0001"
NEW_KEY = "new-rotation-secret-key-32-bytes-0002"


def category_body(name: str = "Pets", kind: str = "expense", **extra: object) -> dict[str, object]:
    return {"name": name, "kind": kind, **extra}


async def test_create_read_update_list_and_soft_delete(
    api_client: ApiClientFactory, as_tenant: TenantSessionFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a)
    category_id = new_uuid7()

    created = await client.post(
        "/v1/categories",
        json={
            "id": str(category_id),
            "kind": "income",
            "name": "Side Income",
            "icon": "  coins ",
            "position": 3,
        },
    )
    assert created.status_code == 201
    body = created.json()
    assert body["icon"] == "coins"
    assert body["is_archived"] is False
    assert set(body) == {
        "id",
        "kind",
        "name",
        "icon",
        "is_archived",
        "position",
        "created_at",
        "updated_at",
    }
    assert (await client.get(f"/v1/categories/{category_id}")).json() == body

    updated = await client.patch(
        f"/v1/categories/{category_id}", json={"name": "Consulting", "icon": None}
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Consulting"
    assert updated.json()["icon"] is None
    assert updated.json()["kind"] == "income"
    assert updated.json()["updated_at"] > body["updated_at"]

    assert (await client.delete(f"/v1/categories/{category_id}")).status_code == 204
    assert (await client.delete(f"/v1/categories/{category_id}")).status_code == 204
    assert (await client.get(f"/v1/categories/{category_id}")).status_code == 404
    assert (
        await client.patch(f"/v1/categories/{category_id}", json={"name": "X"})
    ).status_code == 404
    assert (await client.get("/v1/categories")).json()["items"] == []

    async with as_tenant(tenant_a) as session:
        row = await get_category(session, tenant_a, category_id, include_deleted=True)
        assert row is not None
        assert row.deleted_at is not None


@pytest.mark.parametrize(
    "payload",
    [
        {"kind": "expense", "name": ""},
        {"kind": "expense", "name": "   "},
        {"kind": "expense", "name": "x" * 61},
        {"kind": "expense", "name": None},
        {"kind": "expense"},
        {"name": "A"},
        {"kind": "transfer", "name": "A"},
        {"kind": "INCOME", "name": "A"},
        {"kind": "expense", "name": "A", "icon": ""},
        {"kind": "expense", "name": "A", "icon": "   "},
        {"kind": "expense", "name": "A", "icon": "i" * 33},
        {"kind": "expense", "name": "A", "icon": 5},
        {"kind": "expense", "name": "A", "is_archived": 1},
        {"kind": "expense", "name": "A", "position": -1},
        {"kind": "expense", "name": "A", "position": 2**31},
        {"kind": "expense", "name": "A", "id": "not-a-uuid"},
        {"kind": "expense", "name": "A", "id": str(uuid4())},
        {"kind": "expense", "name": "A", "user_id": str(uuid4())},
        {"kind": "expense", "name": "A", "parent_id": str(uuid4())},
        {"kind": "expense", "name": "A", "created_at": "2020-01-01T00:00:00Z"},
        {"kind": "expense", "name": "A", "deleted_at": None},
    ],
)
async def test_create_rejects_invalid_payloads(
    api_client: ApiClientFactory, tenant_a: UUID, payload: dict[str, object]
) -> None:
    client = await api_client(tenant_a)

    response = await client.post("/v1/categories", json=payload)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert (await client.get("/v1/categories")).json()["items"] == []


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"name": None},
        {"name": ""},
        {"kind": "income"},
        {"is_archived": None},
        {"position": None},
        {"icon": "i" * 33},
        {"id": str(new_uuid7())},
        {"user_id": str(uuid4())},
        {"deleted_at": "2020-01-01T00:00:00Z"},
    ],
)
async def test_update_rejects_invalid_payloads_and_kind_is_immutable(
    api_client: ApiClientFactory, tenant_a: UUID, payload: dict[str, object]
) -> None:
    client = await api_client(tenant_a)
    category_id = (await client.post("/v1/categories", json=category_body())).json()["id"]

    response = await client.patch(f"/v1/categories/{category_id}", json=payload)

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert (await client.get(f"/v1/categories/{category_id}")).json()["kind"] == "expense"


async def test_names_and_icons_are_nfc_normalized_and_trimmed(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a)
    decomposed = unicodedata.normalize("NFD", "Café")

    created = await client.post(
        "/v1/categories", json=category_body(f" {decomposed} ", icon=f"\t{decomposed}\n")
    )

    assert created.json()["name"] == "Café"
    assert created.json()["icon"] == "Café"
    assert (await client.post("/v1/categories", json=category_body("café"))).status_code == 409


async def test_duplicate_names_are_per_kind_and_case_insensitive(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a)
    first = await client.post("/v1/categories", json=category_body("Other", "expense"))
    assert first.status_code == 201

    same_kind = await client.post("/v1/categories", json=category_body("oTHER", "expense"))
    other_kind = await client.post("/v1/categories", json=category_body("Other", "income"))
    sibling = await client.post("/v1/categories", json=category_body("Misc", "expense"))
    rename = await client.patch(f"/v1/categories/{sibling.json()['id']}", json={"name": "OTHER"})

    assert same_kind.status_code == 409
    assert same_kind.json()["code"] == "duplicate_name"
    assert other_kind.status_code == 201
    assert rename.status_code == 409
    assert rename.json()["code"] == "duplicate_name"
    assert (await client.get(f"/v1/categories/{sibling.json()['id']}")).json()["name"] == "Misc"


async def test_a_name_can_be_reused_after_soft_delete_and_by_other_tenants(
    api_client: ApiClientFactory, tenant_a: UUID, tenant_b: UUID
) -> None:
    client_a = await api_client(tenant_a)
    client_b = await api_client(tenant_b)
    first = await client_a.post("/v1/categories", json=category_body("Pets"))

    assert (await client_b.post("/v1/categories", json=category_body("Pets"))).status_code == 201
    assert (await client_a.delete(f"/v1/categories/{first.json()['id']}")).status_code == 204
    again = await client_a.post("/v1/categories", json=category_body("pets"))

    assert again.status_code == 201
    assert again.json()["id"] != first.json()["id"]


async def test_create_is_idempotent_by_client_id(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a)
    payload = {"id": str(new_uuid7()), "kind": "expense", "name": "Pets", "icon": "paw"}

    created = await client.post("/v1/categories", json=payload)
    replay = await client.post("/v1/categories", json=payload)
    conflicts = [
        await client.post("/v1/categories", json={**payload, "name": "Other name"}),
        await client.post("/v1/categories", json={**payload, "kind": "income"}),
        await client.post("/v1/categories", json={**payload, "icon": "dog"}),
        await client.post("/v1/categories", json={**payload, "position": 4}),
    ]

    assert created.status_code == 201
    assert replay.status_code == 200
    assert replay.json() == created.json()
    for conflict in conflicts:
        assert conflict.status_code == 409
        assert conflict.json()["code"] == "id_conflict"
    assert len((await client.get("/v1/categories")).json()["items"]) == 1


async def test_concurrent_identical_creates_yield_one_row(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a)
    payload = {"id": str(new_uuid7()), "kind": "expense", "name": "Race"}

    responses = await asyncio.gather(
        *(client.post("/v1/categories", json=payload) for _ in range(5))
    )

    assert sorted(response.status_code for response in responses) == [200, 200, 200, 200, 201]


async def test_a_deleted_id_cannot_be_recreated(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a)
    payload = {"id": str(new_uuid7()), "kind": "expense", "name": "Gone"}
    await client.post("/v1/categories", json=payload)
    await client.delete(f"/v1/categories/{payload['id']}")

    response = await client.post("/v1/categories", json=payload)

    assert response.status_code == 409
    assert response.json()["code"] == "id_conflict"


async def test_list_filters_by_kind_and_archived_state(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a)
    expense = (await client.post("/v1/categories", json=category_body("Food", "expense"))).json()
    income = (await client.post("/v1/categories", json=category_body("Pay", "income"))).json()
    archived = (
        await client.post("/v1/categories", json=category_body("Old", "expense", is_archived=True))
    ).json()
    deleted = (await client.post("/v1/categories", json=category_body("Gone", "income"))).json()
    await client.delete(f"/v1/categories/{deleted['id']}")

    def ids(response_json: dict[str, list[dict[str, str]]]) -> set[str]:
        return {item["id"] for item in response_json["items"]}

    everything = (await client.get("/v1/categories")).json()
    expenses = (await client.get("/v1/categories", params={"kind": "expense"})).json()
    incomes = (await client.get("/v1/categories", params={"kind": "income"})).json()
    expenses_all = (
        await client.get("/v1/categories", params={"kind": "expense", "include_archived": True})
    ).json()

    assert ids(everything) == {expense["id"], income["id"]}
    assert ids(expenses) == {expense["id"]}
    assert ids(incomes) == {income["id"]}
    assert ids(expenses_all) == {expense["id"], archived["id"]}
    bad_kind = await client.get("/v1/categories", params={"kind": "transfer"})
    assert bad_kind.status_code == 422


async def test_pagination_is_stable_and_complete_with_filters(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a)
    for index, position in enumerate([2, 0, 1, 1, 0]):
        kind = "expense" if index % 2 == 0 else "income"
        await client.post(
            "/v1/categories", json=category_body(f"Cat {index}", kind, position=position)
        )

    for params in ({}, {"kind": "expense"}, {"kind": "income"}):
        everything = (await client.get("/v1/categories", params={**params, "limit": 200})).json()
        expected = [item["id"] for item in everything["items"]]
        seen: list[str] = []
        cursor: str | None = None
        while True:
            page_params: dict[str, str | int] = {**params, "limit": 2}
            if cursor:
                page_params["cursor"] = cursor
            page = (await client.get("/v1/categories", params=page_params)).json()
            seen.extend(item["id"] for item in page["items"])
            cursor = page["next_cursor"]
            if cursor is None:
                break
        assert seen == expected


async def test_limit_bounds_and_default(api_client: ApiClientFactory, tenant_a: UUID) -> None:
    client = await api_client(tenant_a)

    assert (await client.get("/v1/categories")).json()["limit"] == 50
    for good in (1, 200):
        assert (await client.get("/v1/categories", params={"limit": good})).status_code == 200
    for bad in (0, -1, 201):
        assert (await client.get("/v1/categories", params={"limit": bad})).status_code == 422


async def test_tampered_foreign_key_signed_and_rotated_cursors(
    api_client: ApiClientFactory, tenant_a: UUID
) -> None:
    before = await api_client(tenant_a, make_settings(cursor_signing_keys=[OLD_KEY]))
    during = await api_client(tenant_a, make_settings(cursor_signing_keys=[NEW_KEY, OLD_KEY]))
    after = await api_client(tenant_a, make_settings(cursor_signing_keys=[NEW_KEY]))
    for index in range(4):
        await before.post("/v1/categories", json=category_body(f"Cat {index}", position=index))
    old_cursor = (await before.get("/v1/categories", params={"limit": 2})).json()["next_cursor"]

    tampered = await before.get("/v1/categories", params={"cursor": old_cursor + "x"})
    assert tampered.status_code == 400
    assert tampered.json()["code"] == "invalid_cursor"
    assert (await during.get("/v1/categories", params={"cursor": old_cursor})).status_code == 200
    refused = await after.get("/v1/categories", params={"cursor": old_cursor})
    assert refused.status_code == 400
    assert refused.json()["code"] == "invalid_cursor"


async def test_tenant_cannot_see_or_change_another_tenants_categories(
    api_client: ApiClientFactory,
    as_tenant: TenantSessionFactory,
    tenant_a: UUID,
    tenant_b: UUID,
) -> None:
    client_a = await api_client(tenant_a)
    client_b = await api_client(tenant_b)
    category_a = (await client_a.post("/v1/categories", json=category_body("A cat"))).json()
    category_b = (await client_b.post("/v1/categories", json=category_body("B cat"))).json()
    b_id = category_b["id"]

    listed = (await client_a.get("/v1/categories", params={"include_archived": True})).json()
    assert [item["id"] for item in listed["items"]] == [category_a["id"]]
    assert (await client_a.get(f"/v1/categories/{b_id}")).status_code == 404
    assert (
        await client_a.patch(f"/v1/categories/{b_id}", json={"name": "Hijacked"})
    ).status_code == 404
    assert (await client_a.delete(f"/v1/categories/{b_id}")).status_code == 204
    assert (await client_b.get(f"/v1/categories/{b_id}")).json() == category_b

    async def visible_ids(session: AsyncSession) -> list[UUID]:
        owner = await session.scalar(text("SELECT current_setting('app.user_id')::uuid"))
        rows = await session.scalars(select(Category.id).where(Category.user_id == owner))
        return list(rows.all())

    await assert_tenant_isolated(
        as_tenant,
        visible_ids,
        tenant_a,
        tenant_b,
        [UUID(category_a["id"])],
        [UUID(category_b["id"])],
    )


async def test_creating_with_another_tenants_id_looks_like_any_other_id_conflict(
    api_client: ApiClientFactory, tenant_a: UUID, tenant_b: UUID
) -> None:
    client_a = await api_client(tenant_a)
    client_b = await api_client(tenant_b)
    b_id = (await client_b.post("/v1/categories", json=category_body("B cat"))).json()["id"]
    a_id = (await client_a.post("/v1/categories", json=category_body("A cat"))).json()["id"]

    foreign = await client_a.post("/v1/categories", json=category_body("Forged", id=b_id))
    own_mismatch = await client_a.post("/v1/categories", json=category_body("Forged", id=a_id))
    foreign_same_payload = await client_a.post(
        "/v1/categories", json=category_body("B cat", id=b_id)
    )

    for response in (foreign, own_mismatch, foreign_same_payload):
        assert response.status_code == 409
        assert response.json()["code"] == "id_conflict"
    assert foreign.json() == own_mismatch.json() == foreign_same_payload.json()
    assert (await client_b.get(f"/v1/categories/{b_id}")).json()["name"] == "B cat"
