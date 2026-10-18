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


def disable_tenant_rls(op: Operations, table_name: str) -> None:
    """Remove the tenant policy, RLS enforcement, and app-role table grants."""
    table = _quoted_table_name(table_name)
    op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
    op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    op.execute(f"REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE {table} FROM largent_app")
