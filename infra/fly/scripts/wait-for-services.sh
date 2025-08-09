#!/bin/bash
set -e

echo "Waiting for all services to be ready..."

# Wait for PostgreSQL
echo "Checking PostgreSQL..."
until pg_isready -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-kick}"; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done
echo "✓ PostgreSQL is ready"

# Wait for PostgREST
echo "Checking PostgREST..."
until curl -f http://localhost:${INTERNAL_POSTGREST_PORT:-3000}/ > /dev/null 2>&1; do
  echo "Waiting for PostgREST..."
  sleep 2
done
echo "✓ PostgREST is ready"

# Wait for GoTrue
echo "Checking GoTrue..."
until curl -f http://localhost:${INTERNAL_GOTRUE_PORT:-9999}/health > /dev/null 2>&1; do
  echo "Waiting for GoTrue..."
  sleep 2
done
echo "✓ GoTrue is ready"

# Wait for Functions Gateway
echo "Checking Functions Gateway..."
until curl -f http://localhost:${INTERNAL_FNGW_PORT:-8787}/health > /dev/null 2>&1; do
  echo "Waiting for Functions Gateway..."
  sleep 2
done
echo "✓ Functions Gateway is ready"

# Wait for Realtime
echo "Checking Realtime..."
until curl -f http://localhost:${INTERNAL_REALTIME_PORT:-8081}/health > /dev/null 2>&1; do
  echo "Waiting for Realtime..."
  sleep 2
done
echo "✓ Realtime is ready"

echo "🚀 All services are ready!"