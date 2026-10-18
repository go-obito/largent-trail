# ADR 0002: Row-Level Security for Tenant Isolation

- Status: Accepted
- Date: 2026-10-18

## Context

Every tenant-owned row must be isolated by its `user_id`, including raw SQL and
future repositories that accidentally omit an application-level filter. B1 adds
the enforcement plumbing only; it creates no users, domain tables, auth flow, or
production tenant endpoints.

## Decision

Each request obtains its authenticated local user UUID and opens one SQLAlchemy
transaction through `tenant_session`. The session runs
`set_config('app.user_id', :user_id, true)` with a bound parameter. The final
`true` makes the setting transaction-local, so connection-pool reuse cannot
carry a tenant into a later transaction. The UUID alone is bound to structlog
request context. Until B2 implements authentication, `get_current_user_id`
returns a 401 `application/problem+json` response with code `unauthenticated`;
tests can override it through FastAPI dependency overrides.

Tenant tables use `TenantMixin`, which supplies a non-null, indexed `user_id`
UUID. It intentionally has no foreign key in B1 because the local `users` table
does not exist yet. B2 must add the FK with `ON DELETE CASCADE` and update the
mixin in the same change that creates `users`.

The RLS migration helper enables and forces RLS, and installs an all-commands
`tenant_isolation` policy whose `USING` and `WITH CHECK` clauses compare
`user_id` with `nullif(current_setting('app.user_id', true), '')::uuid`. A
missing or empty setting therefore matches no rows and rejects writes. Every
migration creating a `TenantMixin` table must call `enable_tenant_rls`.

`largent_migrator` owns the schema and performs migrations. The application
connects as `largent_app`, a non-superuser without `BYPASSRLS`, with table DML
grants but no ownership or schema-create privilege. RLS is forced so even the
table owner is subject to policy. `system_session` uses the same restricted
application session factory without setting a tenant; application code never
has cross-tenant access through this session.

The security test harness creates only a disposable `tenant_probe` table as the
migrator and enables its policy through the migration helper. It verifies tenant
read/write isolation, missing/empty settings, transaction and pool cleanup,
owner enforcement, least-privilege role behavior, and HTTP dependency behavior.
The schema-wide guardrail fails for any table with a `user_id` column lacking
forced RLS or the `tenant_isolation` policy; a scratch-table test demonstrates
the expected failure and removes the table.

## Consequences

- Services must still filter by `user_id` explicitly for defense in depth.
- Tenant identity must come from verified auth context, never from request data.
- B2 owns the users foreign key and authenticated identity implementation.
- System work that needs tenant rows must run as tenant transactions; system
  sessions cannot bypass RLS.