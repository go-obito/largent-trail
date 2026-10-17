# Runbooks

## Local database recovery

Local Compose data is persisted in the `postgres_data` volume. Before any restore
exercise, take a `pg_dump` using the migrator role and restore it into a fresh
Postgres instance. Production backup retention and restore verification are not yet
configured; establish them before production deployment.
