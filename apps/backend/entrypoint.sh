#!/bin/sh
set -e

echo "Running Prisma migrations..."
node_modules/.bin/prisma migrate deploy --config node_modules/@evcore/db/prisma.config.ts
echo "Migrations complete."

mkdir -p /app/crontabs /app/logrotate /app/logs
cat > /app/crontabs/nestjs <<'EOF'
0 2 * * 4 /app/run-logrotate.sh
EOF

crond -b -l 2 -c /app/crontabs
echo "Log rotation scheduler enabled: Thursday 02:00"

exec node dist/src/main
