#!/usr/bin/env bash
# Usage: ./scripts/db-backup.sh [container] [user] [db]
#   Defaults: evcore-postgres / postgres / evcore

set -euo pipefail

CONTAINER="${1:-evcore-postgres}"
PG_USER="${2:-postgres}"
PG_DB="${3:-evcore}"
BACKUP_DIR="$(dirname "$0")/../backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/${PG_DB}_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

if ! docker inspect "$CONTAINER" &>/dev/null; then
  echo "❌ Container '$CONTAINER' not found or not running." >&2
  exit 1
fi

echo "→ Dumping $PG_DB from $CONTAINER..."
docker exec "$CONTAINER" pg_dump -U "$PG_USER" "$PG_DB" > "$FILE"
echo "✅ Backup saved: $FILE"
