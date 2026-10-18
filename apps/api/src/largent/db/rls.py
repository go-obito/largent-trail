"""Alembic helpers for tenant-table row-level security.

Every table using ``TenantMixin`` must call ``enable_tenant_rls`` in the migration
that creates it.
"""

from __future__ import annotations

import re

from alembic.operations import Operations

_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_POLICY = "user_id = nullif(current_setting('app.user_id', true), '')::uuid"


def _quoted_table_name(table_name: str) -> str:
    if not _IDENTIFIER.fullmatch(table_name):
        raise ValueError("table_name must be a simple SQL identifier")
    return f'"{table_name}"'


def enable_tenant_rls(op: Operations, table_name: str) -> None:
    """Enable and force tenant isolation, then grant app-role DML access."""
    table = _quoted_table_name(table_name)
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY tenant_isolation ON {table} FOR ALL "
        f"USING ({_POLICY}) WITH CHECK ({_POLICY})"
    )
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {table} TO largent_app")


def enable_user_self_rls(op: Operations, table_name: str = "users") -> None:
    """Protect the identity-root table by id and restrict app writes to updates."""
    table = _quoted_table_name(table_name)
    self_policy = "id = nullif(current_setting('app.user_id', true), '')::uuid"
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY user_self ON {table} FOR SELECT TO largent_app USING ({self_policy})"
    )
    op.execute(
        f"CREATE POLICY user_self_update ON {table} FOR UPDATE TO largent_app "
        f"USING ({self_policy}) WITH CHECK ({self_policy})"
    )
    op.execute(
        f"CREATE POLICY user_provision_select ON {table} FOR SELECT TO largent_migrator "
        "USING (true)"
    )
    op.execute(
        f"CREATE POLICY user_provision_insert ON {table} FOR INSERT TO largent_migrator "
        "WITH CHECK (true)"
    )
    op.execute(f"REVOKE ALL ON TABLE {table} FROM largent_app")
    op.execute(f"GRANT SELECT, UPDATE ON TABLE {table} TO largent_app")


def disable_tenant_rls(op: Operations, table_name: str) -> None:
    """Remove the tenant policy, RLS enforcement, and app-role table grants."""
    table = _quoted_table_name(table_name)
    op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
    op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    op.execute(f"REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE {table} FROM largent_app")
