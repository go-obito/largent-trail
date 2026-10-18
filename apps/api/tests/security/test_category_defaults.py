"""Default-category seeding: exactly once per user, never again, never cross-tenant."""

from __future__ import annotations

import asyncio
from uuid import UUID

from sqlalchemy import func, select, text
from tests.security.conftest import ApiClientFactory, TenantSessionFactory

from largent.modules.categories.defaults import (
    DEFAULT_EXPENSE_CATEGORIES,
    DEFAULT_INCOME_CATEGORIES,
)
from largent.modules.categories.models import Category

EXPECTED_EXPENSES = [
    "Food",
    "Transport",
    "Airtime and Data",
    "Utilities",
    "Rent",
    "Health",
    "Education",
    "Shopping",
    "Entertainment",
    "Giving",
    "Family Support",
    "Savings",
    "Other",
]
EXPECTED_INCOME = ["Salary", "Business", "Gift", "Other"]


async def _count_rows(as_tenant: TenantSessionFactory, user_id: UUID) -> int:
    async with as_tenant(user_id) as session:
        return (
            await session.scalar(
                select(func.count()).select_from(Category).where(Category.user_id == user_id)
            )
        ) or 0


async def _seeded_at(as_tenant: TenantSessionFactory, user_id: UUID) -> object:
    async with as_tenant(user_id) as session:
        return await session.scalar(
            text("SELECT defaults_seeded_at FROM users WHERE id = :id"), {"id": user_id}
        )


def test_default_names_and_order_are_the_specified_ones() -> None:
    assert list(DEFAULT_EXPENSE_CATEGORIES) == EXPECTED_EXPENSES
    assert list(DEFAULT_INCOME_CATEGORIES) == EXPECTED_INCOME


async def test_first_list_seeds_the_defaults_once_in_stable_order(
    api_client: ApiClientFactory,
    unseeded_tenants: None,
    as_tenant: TenantSessionFactory,
    tenant_a: UUID,
) -> None:
    client = await api_client(tenant_a)
    assert await _seeded_at(as_tenant, tenant_a) is None

    first = (await client.get("/v1/categories", params={"limit": 200})).json()["items"]
    second = (await client.get("/v1/categories", params={"limit": 200})).json()["items"]

    assert first == second
    expenses = [item for item in first if item["kind"] == "expense"]
    income = [item for item in first if item["kind"] == "income"]
    assert [item["name"] for item in expenses] == EXPECTED_EXPENSES
    assert [item["name"] for item in income] == EXPECTED_INCOME
    assert [item["position"] for item in expenses] == list(range(13))
    assert [item["position"] for item in income] == list(range(4))
    assert all(item["is_archived"] is False and item["icon"] is None for item in first)
    assert await _count_rows(as_tenant, tenant_a) == 17
    assert await _seeded_at(as_tenant, tenant_a) is not None


async def test_two_concurrent_first_requests_seed_exactly_once(
    api_client: ApiClientFactory,
    unseeded_tenants: None,
    as_tenant: TenantSessionFactory,
    tenant_a: UUID,
) -> None:
    client = await api_client(tenant_a)

    responses = await asyncio.gather(*(client.get("/v1/categories") for _ in range(6)))

    assert [response.status_code for response in responses] == [200] * 6
    id_sets = [{item["id"] for item in response.json()["items"]} for response in responses]
    assert all(len(ids) == 17 for ids in id_sets)
    assert all(ids == id_sets[0] for ids in id_sets)
    assert await _count_rows(as_tenant, tenant_a) == 17


async def test_concurrent_first_list_and_create_seed_exactly_once(
    api_client: ApiClientFactory,
    unseeded_tenants: None,
    as_tenant: TenantSessionFactory,
    tenant_a: UUID,
) -> None:
    client = await api_client(tenant_a)

    created, listed = await asyncio.gather(
        client.post("/v1/categories", json={"name": "Pets", "kind": "expense"}),
        client.get("/v1/categories"),
    )

    assert created.status_code == 201
    assert listed.status_code == 200
    assert await _count_rows(as_tenant, tenant_a) == 18


async def test_create_seeds_first_and_conflicts_with_a_default_name(
    api_client: ApiClientFactory, unseeded_tenants: None, tenant_a: UUID
) -> None:
    client = await api_client(tenant_a)

    duplicate = await client.post("/v1/categories", json={"name": "food", "kind": "expense"})
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "duplicate_name"

    created = await client.post("/v1/categories", json={"name": "Pets", "kind": "expense"})
    assert created.status_code == 201
    listed = (await client.get("/v1/categories", params={"limit": 200})).json()["items"]
    assert len(listed) == 18


async def test_deleting_every_category_does_not_reseed(
    api_client: ApiClientFactory,
    unseeded_tenants: None,
    as_tenant: TenantSessionFactory,
    tenant_a: UUID,
) -> None:
    client = await api_client(tenant_a)
    items = (await client.get("/v1/categories", params={"limit": 200})).json()["items"]
    seeded_at = await _seeded_at(as_tenant, tenant_a)

    for item in items:
        assert (await client.delete(f"/v1/categories/{item['id']}")).status_code == 204

    assert (await client.get("/v1/categories")).json()["items"] == []
    assert (await client.get("/v1/categories")).json()["items"] == []
    assert await _count_rows(as_tenant, tenant_a) == 17
    assert await _seeded_at(as_tenant, tenant_a) == seeded_at


async def test_each_user_gets_their_own_defaults(
    api_client: ApiClientFactory,
    unseeded_tenants: None,
    as_tenant: TenantSessionFactory,
    tenant_a: UUID,
    tenant_b: UUID,
) -> None:
    client_a = await api_client(tenant_a)
    client_b = await api_client(tenant_b)

    listed_a, listed_b = await asyncio.gather(
        client_a.get("/v1/categories", params={"limit": 200}),
        client_b.get("/v1/categories", params={"limit": 200}),
    )

    ids_a = {item["id"] for item in listed_a.json()["items"]}
    ids_b = {item["id"] for item in listed_b.json()["items"]}
    assert len(ids_a) == len(ids_b) == 17
    assert ids_a.isdisjoint(ids_b)
    assert await _count_rows(as_tenant, tenant_a) == 17
    assert await _count_rows(as_tenant, tenant_b) == 17


async def test_a_rejected_first_request_does_not_consume_the_seeding(
    api_client: ApiClientFactory,
    unseeded_tenants: None,
    as_tenant: TenantSessionFactory,
    tenant_a: UUID,
) -> None:
    client = await api_client(tenant_a)

    assert (await client.get("/v1/categories", params={"cursor": "bogus"})).status_code == 400
    assert (
        await client.post("/v1/categories", json={"name": "", "kind": "expense"})
    ).status_code == 422
    assert await _seeded_at(as_tenant, tenant_a) is None
    assert len((await client.get("/v1/categories")).json()["items"]) == 17


async def test_seeding_creates_no_accounts_and_is_not_exposed_through_me(
    api_client: ApiClientFactory,
    unseeded_tenants: None,
    tenant_a: UUID,
) -> None:
    client = await api_client(tenant_a)
    await client.get("/v1/categories")

    assert (await client.get("/v1/accounts")).json()["items"] == []
    me = await client.get("/v1/me")
    assert me.status_code == 200
    assert "defaults_seeded_at" not in me.json()
    patch = await client.patch("/v1/me", json={"defaults_seeded_at": None})
    assert patch.status_code == 422
