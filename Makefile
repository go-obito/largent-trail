.PHONY: dev check test migrate revision openapi

dev:
	docker compose up --build

check:
	uv run --directory apps/api ruff format --check
	uv run --directory apps/api ruff check
	uv run --directory apps/api mypy --strict
	$(MAKE) test

test:
	uv run --directory apps/api pytest

migrate:
	docker compose run --build --rm migrate

revision:
	docker compose exec api alembic -c alembic.ini revision --autogenerate -m "$(m)"

openapi:
	uv run --directory apps/api python scripts/export_openapi.py
