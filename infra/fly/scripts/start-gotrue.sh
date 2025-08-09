#!/bin/bash
set -e

echo "Starting GoTrue..."

# Wait for database to be ready
echo "Waiting for database connection..."
until pg_isready -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-kick}"; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done

echo "Database is ready, starting GoTrue..."

# Set GoTrue configuration
export GOTRUE_DB_DRIVER=${GOTRUE_DB_DRIVER:-postgres}
export GOTRUE_DB_DATABASE_URL=${GOTRUE_DB_DATABASE_URL}
export GOTRUE_API_HOST=0.0.0.0
export GOTRUE_PORT=${INTERNAL_GOTRUE_PORT:-9999}
export GOTRUE_SITE_URL=${GOTRUE_SITE_URL}
export GOTRUE_URI_ALLOW_LIST=${GOTRUE_URI_ALLOW_LIST}
export GOTRUE_JWT_SECRET=${GOTRUE_JWT_SECRET:-${JWT_SECRET}}
export GOTRUE_JWT_EXP=${GOTRUE_JWT_EXP:-3600}
export GOTRUE_JWT_AUD=${GOTRUE_JWT_AUD:-authenticated}
export GOTRUE_JWT_DEFAULT_GROUP_NAME=${GOTRUE_JWT_DEFAULT_GROUP_NAME:-authenticated}
export GOTRUE_DISABLE_SIGNUP=false
export GOTRUE_MAILER_AUTOCONFIRM=true

# Start GoTrue
exec /usr/local/bin/gotrue