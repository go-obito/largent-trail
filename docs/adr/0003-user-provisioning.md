# ADR 0003: Local User Provisioning and Identity-Root RLS

- Status: Accepted
- Date: 2026-10-18

## Context

Tenant sessions need a local user UUID before they can set `app.user_id`, but a
first-time provider subject has no local row yet. Looking up or inserting that
row through normal application access would either fail self-RLS or give the app
role cross-tenant privileges.

## Decision

The first migration creates `users`, keyed by UUIDv7 `id`, with a unique
`(auth_provider, auth_subject)` pair. UUIDv7 is generated in the PostgreSQL
`provision_user` function from the current millisecond timestamp and
`gen_random_uuid()` random bits; this preserves the four-argument function API
and keeps provisioning atomic.

Two narrowly scoped `SECURITY DEFINER` functions, `resolve_user` and
`provision_user`, are owned by `largent_migrator`, pin `search_path` to
`pg_catalog, public`, use fully qualified table names, revoke `PUBLIC` execute,
and grant execute only to `largent_app`. `provision_user` uses
`INSERT ... ON CONFLICT DO NOTHING` and then selects the unique provider subject,
so concurrent first requests return the same UUID.

`users` is the sole §7 tenant-table exception: it is the identity-root table and
has no `user_id`; self-access RLS is keyed by `id`. The test guardrail explicitly
lists only `users`, and any further exception requires an ADR. The app role gets
table `SELECT, UPDATE` only, with the `user_self` SELECT policy and a separate
`user_self_update` UPDATE policy.
Because `FORCE ROW LEVEL SECURITY` also applies to the requested function owner,
`largent_migrator` has only `SELECT` and `INSERT` policies on this table. These
policies are granted to that role only, never `PUBLIC`; the function owner has
no `UPDATE` or `DELETE` policy.

The service first calls `resolve_user` and calls `provision_user` only when no
row exists. Both calls use B1's `system_session`; the resulting UUID is then
used by the tenant-session dependency for profile access.

Python's `zoneinfo` requires an IANA timezone database. The final slim API image
installs OS `tzdata`; Windows development adds the Python `tzdata` package only
to the dev dependency group. CI tests `Africa/Accra` in Python and in the built
container.

## Consequences

- `users.id` is the tenant key used by all future `TenantMixin` rows and is
  referenced with `ON DELETE CASCADE`.
- The application role cannot create or hard-delete users directly.
- Email and display name are optional claim snapshots, not identity keys.
- B10 remains responsible for user hard deletion and dependent-data lifecycle.