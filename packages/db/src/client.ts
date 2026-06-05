import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Singleton pattern — prevents multiple PrismaClient instances in dev (hot reload)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  // PGBOUNCER_URL when PgBouncer is in front (prod + dev), fallback to direct DATABASE_URL
  const adapter = new PrismaPg({
    connectionString:
      process.env["PGBOUNCER_URL"] ?? process.env["DATABASE_URL"],
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
