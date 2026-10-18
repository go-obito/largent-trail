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
Set `CLERK_ISSUER`, `CLERK_AUDIENCE`, and the JSON `CLERK_AUTHORIZED_PARTIES` list in
`.env`; `CLERK_JWKS_URL` is optional and defaults to the issuer's standard JWKS path.
The example issuer is a placeholder and must be replaced with the Clerk instance issuer.

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
