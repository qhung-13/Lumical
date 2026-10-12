#!/bin/sh
set -eu
: "${MIGRATION_DB_PASSWORD:?Set a local migration password}"
: "${RUNTIME_DB_PASSWORD:?Set a separate local runtime password}"
for password in "$POSTGRES_PASSWORD" "$MIGRATION_DB_PASSWORD" "$RUNTIME_DB_PASSWORD"; do
  case "$password" in
    REPLACE*|'') echo 'Generate local database passwords before starting PostgreSQL.' >&2; exit 1 ;;
  esac
done
if [ "$POSTGRES_PASSWORD" = "$MIGRATION_DB_PASSWORD" ] || [ "$POSTGRES_PASSWORD" = "$RUNTIME_DB_PASSWORD" ] || [ "$MIGRATION_DB_PASSWORD" = "$RUNTIME_DB_PASSWORD" ]; then
  echo 'Use three different database passwords.' >&2
  exit 1
fi
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v db="$POSTGRES_DB" -v migration_password="$MIGRATION_DB_PASSWORD" -v runtime_password="$RUNTIME_DB_PASSWORD" <<'SQL'
CREATE ROLE lumical_migration LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD :'migration_password';
CREATE ROLE lumical_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD :'runtime_password';
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
ALTER DEFAULT PRIVILEGES FOR ROLE lumical_migration IN SCHEMA lumical REVOKE ALL ON FUNCTIONS FROM PUBLIC;
SQL
