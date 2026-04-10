#!/bin/sh
set -e

echo "Running Prisma migrations..."
node_modules/.bin/prisma migrate deploy --config node_modules/@evcore/db/prisma.config.ts
echo "Migrations complete."

exec node dist/src/main
