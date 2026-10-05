#!/usr/bin/env bash
# Restore a production dump into the local Docker Postgres, replacing the
# local database entirely.
#
# Usage: ./scripts/db-restore.sh <dump-file> [container] [user] [db]
#   Defaults: evcore-postgres / postgres / evcore
#
# Accepts a custom-format dump (`pg_dump -Fc`, restored with pg_restore) or a
# plain SQL dump (`pg_dump` default, restored with psql). Plain dumps made by
# PostgreSQL 18 start with a `\restrict` line; psql handles it.
#
# The local database is dropped and recreated: every local row is lost.

set -euo pipefail

DUMP="${1:?usage: $0 <dump-file> [container] [user] [db]}"
CONTAINER="${2:-evcore-postgres}"
PG_USER="${3:-postgres}"
PG_DB="${4:-evcore}"
COMPOSE_FILE="$(dirname "$0")/../docker-compose.yml"

if [[ ! -f "$DUMP" ]]; then
  echo "❌ Dump file not found: $DUMP" >&2
  exit 1
fi

if ! docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true; then
  echo "→ Starting $CONTAINER..."
  docker compose -f "$COMPOSE_FILE" up -d postgres
fi

echo "→ Waiting for Postgres to accept connections..."
for _ in $(seq 1 30); do
  if docker exec "$CONTAINER" pg_isready -U "$PG_USER" -q; then break; fi
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U "$PG_USER" -q

echo "→ Dropping and recreating $PG_DB (all local data is discarded)..."
docker exec "$CONTAINER" psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 -q \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$PG_DB' AND pid <> pg_backend_pid();" \
  -c "DROP DATABASE IF EXISTS \"$PG_DB\";" \
  -c "CREATE DATABASE \"$PG_DB\";"

CONTAINER_DUMP="/tmp/$(basename "$DUMP")"
echo "→ Copying dump into the container..."
docker cp "$DUMP" "$CONTAINER:$CONTAINER_DUMP"

if head -c 5 "$DUMP" | grep -q 'PGDMP'; then
  echo "→ Restoring custom-format dump with pg_restore..."
  docker exec "$CONTAINER" pg_restore -U "$PG_USER" -d "$PG_DB" \
    --no-owner --no-privileges --jobs 4 "$CONTAINER_DUMP"
else
  echo "→ Restoring plain SQL dump with psql..."
  docker exec "$CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -q \
    -v ON_ERROR_STOP=1 -f "$CONTAINER_DUMP" > /dev/null
fi

docker exec "$CONTAINER" rm -f "$CONTAINER_DUMP"

echo "→ Row counts of the main tables:"
docker exec "$CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -c "
SELECT relname AS table, n_live_tup AS rows
FROM pg_stat_user_tables
WHERE relname IN ('fixture','model_run','channel_selection','coupon_proposal',
                  'coupon_proposal_leg','odds_snapshot','fixture_statistic','team_stats')
ORDER BY relname;"

echo "→ Latest applied migration:"
docker exec "$CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -At \
  -c "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1;"

echo "✅ $PG_DB restored from $DUMP"
