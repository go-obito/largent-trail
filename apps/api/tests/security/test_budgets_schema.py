"""Schema-level guarantees of the budgets table, checked against real Postgres."""

from __future__ import annotations

from uuid import UUID

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from tests.security.conftest import TenantDatabaseURLs, TenantSessionFactory

from largent.core.ids import new_uuid7
from largent.core.tenancy import SessionFactory, system_session


async def _insert_category(session: AsyncSession, user_id: UUID, kind: str = "expense") -> UUID:
    category_id = new_uuid7()
    await session.execute(
        text(
            "INSERT INTO categories (id, user_id, kind, name) "
            "VALUES (:id, :u, CAST(:k AS category_kind), :n)"
        ),
        {"id": category_id, "u": user_id, "k": kind, "n": f"Category {category_id}"},
    )
    return category_id


async def _insert_budget(
    session: AsyncSession,
    user_id: UUID,
    category_id: UUID,
    *,
    period: str = "weekly",
    limit_minor: int = 7_800,
    deleted: bool = False,
) -> UUID:
    budget_id = new_uuid7()
    await session.execute(
        text(
            "INSERT INTO budgets (id, user_id, category_id, period, limit_minor, deleted_at) "
            "VALUES (:id, :u, :c, CAST(:p AS budget_period), :l, "
            "CASE WHEN :del THEN now() END)"
        ),
        {
            "id": budget_id,
            "u": user_id,
            "c": category_id,
            "p": period,
            "l": limit_minor,
            "del": deleted,
        },
    )
    return budget_id


async def test_budgets_table_has_forced_rls_and_the_composite_fk_targets(
    tenant_database: TenantDatabaseURLs,
) -> None:
    engine = create_async_engine(tenant_database.admin)
    try:
        async with engine.connect() as connection:
            flags = (
                await connection.execute(
                    text(
                        "SELECT relrowsecurity, relforcerowsecurity FROM pg_class "
                        "WHERE relname = 'budgets' AND relkind = 'r'"
                    )
                )
            ).one()
            unique: set[str] = set(
                (
                    await connection.execute(
                        text(
                            "SELECT conname FROM pg_constraint "
                            "WHERE contype = 'u' AND conrelid = 'budgets'::regclass"
                        )
                    )
                ).scalars()
            )
            policy: int = (
                await connection.execute(
                    text(
                        "SELECT count(*) FROM pg_policy "
                        "WHERE polrelid = 'budgets'::regclass AND polname = 'tenant_isolation'"
                    )
                )
            ).scalar_one()
            composite_fk: set[str] = set(
                (
                    await connection.execute(
                        text(
                            "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
                            "WHERE contype = 'f' AND conrelid = 'budgets'::regclass "
                            "AND confrelid = 'categories'::regclass"
                        )
                    )
                ).scalars()
            )
            partial_index: str = (
                await connection.execute(
                    text(
                        "SELECT indexdef FROM pg_indexes "
                        "WHERE indexname = 'uq_budgets_user_id_category_id_period_active'"
                    )
                )
            ).scalar_one()
    finally:
        await engine.dispose()

    assert tuple(flags) == (True, True)
    assert policy == 1
    assert unique == {"uq_budgets_user_id_id"}
    assert composite_fk == {
        "FOREIGN KEY (user_id, category_id, kind) REFERENCES categories(user_id, id, kind)"
    }
    assert "UNIQUE" in partial_index
    assert "(user_id, category_id, period)" in partial_index
    assert "deleted_at IS NULL" in partial_index


async def test_the_app_role_sees_no_budget_rows_without_a_tenant_setting(
    seeded_tenants: None,
    as_tenant: TenantSessionFactory,
    app_session_factory: SessionFactory,
    tenant_a: UUID,
) -> None:
    async with as_tenant(tenant_a) as session:
        await _insert_budget(session, tenant_a, await _insert_category(session, tenant_a))

    async with system_session(app_session_factory) as session:
        count: int = (await session.execute(text("SELECT count(*) FROM budgets"))).scalar_one()

    assert count == 0


async def test_the_database_defaults_the_kind_to_expense_and_the_currency_to_ghs(
    seeded_tenants: None, as_tenant: TenantSessionFactory, tenant_a: UUID
) -> None:
    async with as_tenant(tenant_a) as session:
        await _insert_budget(session, tenant_a, await _insert_category(session, tenant_a))
        row = (await session.execute(text("SELECT kind::text, currency FROM budgets"))).one()

    assert tuple(row) == ("expense", "GHS")


async def test_the_database_rejects_an_income_category(
    seeded_tenants: None, as_tenant: TenantSessionFactory, tenant_a: UUID
) -> None:
    with pytest.raises(IntegrityError, match="fk_budgets_user_id_category_id_kind_categories"):
        async with as_tenant(tenant_a) as session:
            income = await _insert_category(session, tenant_a, "income")
            await _insert_budget(session, tenant_a, income)


async def test_the_database_rejects_a_non_expense_kind_even_for_an_income_category(
    seeded_tenants: None, as_tenant: TenantSessionFactory, tenant_a: UUID
) -> None:
    with pytest.raises(IntegrityError, match="ck_budgets_kind_expense_only"):
        async with as_tenant(tenant_a) as session:
            income = await _insert_category(session, tenant_a, "income")
            await session.execute(
                text(
                    "INSERT INTO budgets (id, user_id, category_id, kind, period, limit_minor) "
                    "VALUES (:id, :u, :c, 'income', 'weekly', 100)"
                ),
                {"id": new_uuid7(), "u": tenant_a, "c": income},
            )


async def test_the_database_rejects_changing_the_kind_of_a_budgeted_category(
    seeded_tenants: None, as_tenant: TenantSessionFactory, tenant_a: UUID
) -> None:
    async with as_tenant(tenant_a) as session:
        category_id = await _insert_category(session, tenant_a)
        await _insert_budget(session, tenant_a, category_id)

    with pytest.raises(IntegrityError, match="fk_budgets_user_id_category_id_kind_categories"):
        async with as_tenant(tenant_a) as session:
            await session.execute(
                text("UPDATE categories SET kind = 'income' WHERE id = :id"), {"id": category_id}
            )


async def test_the_database_rejects_another_tenants_category(
    seeded_tenants: None, as_tenant: TenantSessionFactory, tenant_a: UUID, tenant_b: UUID
) -> None:
    async with as_tenant(tenant_b) as session:
        foreign_category = await _insert_category(session, tenant_b)

    with pytest.raises(IntegrityError, match="fk_budgets_user_id_category_id_kind_categories"):
        async with as_tenant(tenant_a) as session:
            await _insert_budget(session, tenant_a, foreign_category)


@pytest.mark.parametrize("limit_minor", [0, -1, 10**12 + 1])
async def test_the_database_rejects_out_of_range_limits(
    seeded_tenants: None, as_tenant: TenantSessionFactory, tenant_a: UUID, limit_minor: int
) -> None:
    with pytest.raises(IntegrityError, match="ck_budgets_limit_range"):
        async with as_tenant(tenant_a) as session:
            category_id = await _insert_category(session, tenant_a)
            await _insert_budget(session, tenant_a, category_id, limit_minor=limit_minor)


async def test_the_database_accepts_the_limit_bounds(
    seeded_tenants: None, as_tenant: TenantSessionFactory, tenant_a: UUID
) -> None:
    async with as_tenant(tenant_a) as session:
        await _insert_budget(
            session, tenant_a, await _insert_category(session, tenant_a), limit_minor=1
        )
        await _insert_budget(
            session, tenant_a, await _insert_category(session, tenant_a), limit_minor=10**12
        )


async def test_the_database_rejects_other_currencies_and_periods(
    seeded_tenants: None, as_tenant: TenantSessionFactory, tenant_a: UUID
) -> None:
    async with as_tenant(tenant_a) as session:
        category_id = await _insert_category(session, tenant_a)

    for period, currency, error in (
        ("weekly", "USD", "ck_budgets_currency_ghs_only"),
        ("daily", "GHS", "budget_period"),
    ):
        with pytest.raises(DBAPIError, match=error):
            async with as_tenant(tenant_a) as session:
                await session.execute(
                    text(
                        "INSERT INTO budgets (id, user_id, category_id, period, limit_minor, "
                        "currency) VALUES (:id, :u, :c, CAST(:p AS budget_period), 100, :cur)"
                    ),
                    {
                        "id": new_uuid7(),
                        "u": tenant_a,
                        "c": category_id,
                        "p": period,
                        "cur": currency,
                    },
                )


async def test_the_database_allows_one_live_budget_per_category_and_period(
    seeded_tenants: None, as_tenant: TenantSessionFactory, tenant_a: UUID
) -> None:
    async with as_tenant(tenant_a) as session:
        category_id = await _insert_category(session, tenant_a)
        await _insert_budget(session, tenant_a, category_id, period="weekly")
        await _insert_budget(session, tenant_a, category_id, period="monthly")
        await _insert_budget(session, tenant_a, category_id, period="weekly", deleted=True)
        await _insert_budget(session, tenant_a, category_id, period="weekly", deleted=True)

    with pytest.raises(IntegrityError, match="uq_budgets_user_id_category_id_period_active"):
        async with as_tenant(tenant_a) as session:
            await _insert_budget(session, tenant_a, category_id, period="weekly")


async def test_deleting_a_user_removes_their_budgets(
    seeded_tenants: None,
    as_tenant: TenantSessionFactory,
    tenant_a: UUID,
    tenant_database: TenantDatabaseURLs,
) -> None:
    async with as_tenant(tenant_a) as session:
        await _insert_budget(session, tenant_a, await _insert_category(session, tenant_a))

    engine = create_async_engine(tenant_database.admin)
    try:
        async with engine.begin() as connection:
            await connection.execute(text("DELETE FROM users WHERE id = :id"), {"id": tenant_a})
            remaining: int = (
                await connection.execute(text("SELECT count(*) FROM budgets"))
            ).scalar_one()
    finally:
        await engine.dispose()

    assert remaining == 0
