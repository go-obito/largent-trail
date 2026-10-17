-- Development-only credentials are mirrored in .env.example. Production injects unique secrets.
CREATE ROLE largent_migrator
    LOGIN
    PASSWORD 'largent_migrator_local_password'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE largent_app
    LOGIN
    PASSWORD 'largent_app_local_password'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO largent_migrator;
GRANT CONNECT ON DATABASE largent TO largent_migrator, largent_app;
GRANT USAGE, CREATE ON SCHEMA public TO largent_migrator;
GRANT USAGE ON SCHEMA public TO largent_app;
ALTER DEFAULT PRIVILEGES FOR ROLE largent_migrator IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO largent_app;
ALTER DEFAULT PRIVILEGES FOR ROLE largent_migrator IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO largent_app;
