# Largent

Largent is a mobile-first personal-finance PWA for Ghana (GHS). This repository
currently contains the production-minded FastAPI backend foundation only; product
features, authentication, tables, and frontend code are deliberately not present yet.

## Quickstart

Prerequisites: Docker Desktop with Compose, GNU Make, and [uv](https://docs.astral.sh/uv/).

```sh
cp .env.example .env
make dev
```

The API is at <http://localhost:8000>; liveness is
<http://localhost:8000/healthz> and dependency readiness is
<http://localhost:8000/readyz>. OpenAPI is intentionally empty at B0 because no
versioned API endpoints exist yet.

```sh
make check
make migrate
make openapi
```

`make dev` starts API, Postgres, Redis, and the idle ARQ worker. See
`docs/product-spec.md` for the current product constraints and `docs/runbooks/`
for operational notes.
