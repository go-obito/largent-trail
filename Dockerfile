FROM python:3.12-slim-bookworm AS builder

COPY --from=ghcr.io/astral-sh/uv:0.12.2 /uv /uvx /bin/
ENV UV_PROJECT_ENVIRONMENT=/opt/venv

WORKDIR /build
COPY apps/api/pyproject.toml apps/api/uv.lock ./
COPY apps/api/README.md ./README.md
RUN uv sync --frozen --no-dev --no-install-project
COPY apps/api/src ./src
RUN uv sync --frozen --no-dev

FROM python:3.12-slim-bookworm AS runtime

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONPATH="/app/src" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 largent \
    && useradd --uid 10001 --gid largent --create-home largent
WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY apps/api/alembic ./alembic
COPY apps/api/alembic.ini ./alembic.ini
COPY apps/api/src ./src
RUN chown -R largent:largent /app
USER largent

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["python", "-c", "import os; from urllib.request import urlopen; urlopen('http://127.0.0.1:' + os.getenv('PORT', '8000') + '/healthz', timeout=3)"]

CMD ["sh", "-c", "exec uvicorn largent.main:create_app --factory --host 0.0.0.0 --port ${PORT:-8000}"]
