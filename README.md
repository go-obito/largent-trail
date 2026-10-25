# Largent

Largent is a mobile-first personal-finance PWA for Ghana (GHS). This repository
currently contains the production-minded FastAPI backend, Clerk JWT
verification, local user provisioning, and the initial user profile API. Other product
features and frontend code are still to follow.

## Quickstart

Prerequisites: Docker Desktop with Compose, GNU Make, and [uv](https://docs.astral.sh/uv/).

```sh
cp .env.example .env
docker compose up --build
```

`docker compose up` runs the one-shot migration service first; the API and worker
start only after migrations complete successfully. `make dev` is also available
as a convenience wrapper. Production deployments run migrations as a separate,
explicit deployment step; see [B11 in the decisions](docs/DECISIONS.md).

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

`make migrate` runs the same migration service directly.

The API image installs the operating-system IANA timezone database for profile
validation. Windows development installs the `tzdata` Python package through the dev
group only; Linux development and production use system timezone data.

Runtime dependency notes: `pyjwt[crypto]` provides hardened RS256/JWKS JWT
verification; `httpx` is a runtime dependency for asynchronous JWKS retrieval.

`docker compose up --build` starts Postgres, Redis, migrations, API, and the idle
ARQ worker in dependency order. See
`docs/product-spec.md` for the current product constraints and `docs/runbooks/`
for operational notes.

## Railway deployment

Deploy the API from this repository with the repository root as the service root.
For an existing legacy Railway service, `railway.json` selects the root
`Dockerfile`, bootstraps the restricted PostgreSQL roles, applies Alembic
migrations in the pre-deploy phase, starts Uvicorn on Railway's assigned `$PORT`,
and checks `/readyz` before considering the deployment healthy.

### API service variables

Configure these PostgreSQL variables on the Railway API service:

- `DATABASE_BOOTSTRAP_URL`: the privileged PostgreSQL connection URL. The role
  must have `CREATEROLE` or superuser privileges. This URL is used only during
  pre-deploy bootstrap and must point to the same database as the two URLs below.
- `DATABASE_URL`: a PostgreSQL URL with username `largent_app` and the app role's
  password. This restricted role is used by the API at runtime.
- `MIGRATION_DATABASE_URL`: a PostgreSQL URL with username `largent_migrator`
  and the migrator role's password. This role applies Alembic migrations.

The deployment bootstrap creates these roles if absent, synchronizes their passwords
from the two role-specific URLs, enforces `NOSUPERUSER NOCREATEDB NOCREATEROLE
NOINHERIT NOBYPASSRLS`, and applies the schema grants expected by migrations.
It rejects URLs that target different database names. Your Railway database name
is `railway`, so all three connection URLs must end in `/railway`.

Generate distinct strong passwords for the app and migration roles. Build the two
role-specific URLs with Railway's PostgreSQL host and port, URL-encoding any
special characters in passwords. Keep the privileged connection URL separate from
the runtime API URL.
- `REDIS_URL`: reference the Railway Redis service's connection URL.
- `CORS_ALLOWED_ORIGINS`: a JSON array containing the exact deployed frontend origin,
  for example `["https://your-frontend.example"]`. Do not use a wildcard.
- `CLERK_ISSUER`: the issuer URL for your production Clerk instance.
- `CLERK_AUTHORIZED_PARTIES`: a JSON array of trusted frontend origins, for example
  `["https://your-frontend.example"]`.
- `CURSOR_SIGNING_KEYS`: generate a strong secret locally with
  `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Keep it in Railway
  Variables; do not commit it.

The settings layer converts `postgres://` and `postgresql://` values for both
PostgreSQL variables to `postgresql+asyncpg://` before validating them, so the
common Railway PostgreSQL URL format works without manually editing its scheme.
The Docker image and default command also respect Railway's assigned `PORT`.

Optional variables include `CLERK_JWKS_URL`, `CLERK_AUDIENCE`, `SENTRY_DSN`,
and `OTLP_ENDPOINT`. Leave `CLERK_AUDIENCE` unset unless your Clerk tokens are
configured to include the matching audience claim.

### Worker service

The ARQ worker is a separate process. To run it on Railway, create a second service
from the same repository and Dockerfile, link the same PostgreSQL and Redis services,
and override that service's start command with:

```sh
arq largent.workers.settings.WorkerSettings
```

The worker requires `DATABASE_URL` and `REDIS_URL`; it does not run API migrations.
Do not use the API migration start command for the worker service.

**Railway configuration compatibility:** Railway is retiring legacy Config as Code
(`railway.json` / `railway.toml`) on 2026-12-01, and new services cannot opt into
it. For a newly created service or a long-lived setup, migrate the existing Railway
project configuration to `.railway/railway.ts` using Railway's CLI
(`railway config migrate`, then review with `railway config plan` before applying).
Import the existing project first; do not apply a project-wide IaC definition that
omits existing services or databases.

### Deployment verification

After deployment, confirm that the API service passes its `/readyz` health check.
This endpoint checks both PostgreSQL and Redis. If the deployment fails, inspect the
Railway deployment logs first: migration errors happen before Uvicorn starts, while a
failed readiness check indicates that a required dependency is unavailable.

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
