# Largent

Largent is a mobile-first personal-finance PWA for Ghana (GHS). This repository
currently contains the production-minded FastAPI backend, Clerk JWT
verification, local user provisioning, and the initial user profile API. Other product
features and frontend code are still to follow.

## Quickstart

Prerequisites: Docker Desktop with Compose, GNU Make, and [uv](https://docs.astral.sh/uv/).

```sh
cp .env.example .env
make dev
```

The API is at <http://localhost:8000>; liveness is
<http://localhost:8000/healthz> and dependency readiness is
<http://localhost:8000/readyz>. `GET` and `PATCH /v1/me` require a Clerk bearer token.
Set `CLERK_ISSUER` and the JSON `CLERK_AUTHORIZED_PARTIES` list in
`.env`; `CLERK_JWKS_URL` is optional and defaults to the issuer's standard JWKS path.
`CLERK_AUDIENCE` is also optional: when set, tokens must carry a matching `aud` claim and
are rejected otherwise; when unset, `aud` is not checked (`iss`, `azp`, `exp`, `nbf`, `sub`
and RS256-only signing are always enforced).
The example issuer is a placeholder and must be replaced with the Clerk instance issuer.
Set `CURSOR_SIGNING_KEYS` in `.env` (required in every environment, no default): a
comma-separated list of secrets, each at least 32 bytes, for example
`python -c "import secrets; print(secrets.token_urlsafe(48))"`. The API refuses to start if
it is missing or any key is too short. The first key signs pagination cursors and all keys
verify them, so rotate by prepending a new key and removing the old one after cursors
signed with it have expired from clients. Keys are never logged.

```sh
make check
make migrate
make openapi
```

The API image installs the operating-system IANA timezone database for profile
validation. Windows development installs the `tzdata` Python package through the dev
group only; Linux development and production use system timezone data.

Runtime dependency notes: `pyjwt[crypto]` provides hardened RS256/JWKS JWT
verification; `httpx` is a runtime dependency for asynchronous JWKS retrieval.

`make dev` starts API, Postgres, Redis, and the idle ARQ worker. See
`docs/product-spec.md` for the current product constraints and `docs/runbooks/`
for operational notes.

## How to add a tenant table

Define tenant-owned models with `TenantMixin` and `largent.db.base.Base`. In the
table-creation migration, call `enable_tenant_rls(op, "table_name")` after
creating the table. Add repository or endpoint isolation tests using the fixtures
and `assert_tenant_isolated` helper in `tests/security/conftest.py`. See
[`docs/adr/0002-row-level-security-tenancy.md`](docs/adr/0002-row-level-security-tenancy.md)
for the session and role model.

Child tables reference parents with composite foreign keys `(user_id, parent_id) ->
parent (user_id, id)`. When a child must also agree with a parent attribute (a
transaction's `kind` must equal its category's `kind`), add that attribute to the key:
put `UNIQUE (user_id, id, kind)` on the parent and reference
`(user_id, category_id, kind)` from the child, using the same enum type on both sides.
With a nullable parent column and `MATCH SIMPLE`, a NULL parent is simply not checked.
See [`docs/adr/0005-transactions.md`](docs/adr/0005-transactions.md).
