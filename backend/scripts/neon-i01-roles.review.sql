-- psql CLI ONLY. Do not paste this file into Neon SQL Editor: it uses psql meta-commands.
-- Create-only bootstrap; refuses existing roles/schema rather than changing credentials.
-- Baseline: backend/database/init/00-roles.sh.
-- Run only against the reviewed, dedicated Neon database as its bootstrap owner.
-- Supply distinct random migration_password and runtime_password psql variables
-- through confidential input; do not pass secrets in command-line arguments.
-- Do not enable query echo or statement logging that exposes password literals.
\set ON_ERROR_STOP on
SELECT current_database() AS db \gset
BEGIN;

DO $$
BEGIN
  IF current_database() <> 'neondb' THEN
    RAISE EXCEPTION 'Unexpected database; review the intended target first';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('lumical_migration', 'lumical_runtime'))
     OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'lumical') THEN
    RAISE EXCEPTION 'Roles/schema already exist; inspect privileges before continuing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
  ) THEN
    RAISE EXCEPTION 'Database is no longer empty; review shared-database impact first';
  END IF;
END $$;

-- Match the initializer's requirement for distinct, non-placeholder hex secrets.
SELECT set_config('lumical_bootstrap.migration_password', :'migration_password', true) IS NOT NULL
   AND set_config('lumical_bootstrap.runtime_password', :'runtime_password', true) IS NOT NULL
   AS secret_inputs_loaded \gset
DO $$
DECLARE
  migration_secret text := current_setting('lumical_bootstrap.migration_password');
  runtime_secret text := current_setting('lumical_bootstrap.runtime_password');
BEGIN
  IF migration_secret !~ '^[0-9a-fA-F]{64,}$'
     OR runtime_secret !~ '^[0-9a-fA-F]{64,}$'
     OR migration_secret = runtime_secret THEN
    RAISE EXCEPTION 'Supply two distinct random hexadecimal secrets of at least 32 bytes';
  END IF;
END $$;

CREATE ROLE lumical_migration LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD :'migration_password';
CREATE ROLE lumical_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD :'runtime_password';
-- Neon owners are not PostgreSQL superusers and need explicit SET authority
-- to assign schema ownership and manage this role's default privileges.
GRANT lumical_migration TO CURRENT_USER WITH SET TRUE;
CREATE SCHEMA lumical AUTHORIZATION lumical_migration;
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE :"db" TO lumical_migration;
GRANT CONNECT ON DATABASE :"db" TO lumical_runtime;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA lumical FROM PUBLIC;
GRANT USAGE ON SCHEMA lumical TO lumical_runtime;
ALTER ROLE lumical_migration SET search_path TO lumical;
ALTER ROLE lumical_runtime SET search_path TO lumical;
ALTER DEFAULT PRIVILEGES FOR ROLE lumical_migration IN SCHEMA lumical REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE lumical_migration IN SCHEMA lumical REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE lumical_migration IN SCHEMA lumical REVOKE ALL ON FUNCTIONS FROM PUBLIC;
COMMIT;
