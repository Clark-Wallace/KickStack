#!/bin/bash
set -e

echo "Starting PostgREST..."

# Wait for database to be ready
echo "Waiting for database connection..."
until pg_isready -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-kick}"; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done

echo "Database is ready, starting PostgREST..."

# Set PostgREST configuration
export PGRST_DB_URI=${PGRST_DB_URI}
export PGRST_DB_SCHEMA=${PGRST_DB_SCHEMA:-public}
export PGRST_DB_ANON_ROLE=${PGRST_DB_ANON_ROLE:-anon}
export PGRST_JWT_SECRET=${PGRST_JWT_SECRET:-${JWT_SECRET}}
export PGRST_SERVER_PORT=${INTERNAL_POSTGREST_PORT:-3000}

# Start PostgREST
exec /usr/local/bin/postgrest /app/postgrest.conf