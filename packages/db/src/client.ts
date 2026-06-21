import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Singleton pattern — prevents multiple PrismaClient instances in dev (hot reload)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  // PGBOUNCER_URL when PgBouncer is in front (prod + dev), fallback to direct DATABASE_URL
  //
  // `max` is the app-side pg.Pool size — the real ceiling on concurrent queries.
  // It is NOT the URL `connection_limit` param (that one is for Prisma's native
  // engine and is ignored by the pg adapter). Keep it below PgBouncer's
  // DEFAULT_POOL_SIZE so background jobs and the API can share connections
  // without starving each other. pg default is 10.
  const adapter = new PrismaPg({
    connectionString:
      process.env["PGBOUNCER_URL"] ?? process.env["DATABASE_URL"],
    max: Number.parseInt(process.env["DATABASE_POOL_MAX"] ?? "10", 10) || 10,
  });
  return new PrismaClient({
    adapter,
    log: ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}
