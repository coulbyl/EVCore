/**
 * CLI wrapper around the channel-backfill verification gate (logic in
 * verify-channel-backfill.lib.ts). Read-only. Exits non-zero if the gate fails,
 * so it can block a deploy / DROP step in CI.
 *
 * Run after build:
 *   cd apps/backend
 *   pnpm build
 *   node dist/scripts/verify-channel-backfill.js
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaModule } from '@/prisma.module';
import { PrismaService } from '@/prisma.service';
import { verifyBackfill } from './verify-channel-backfill.lib';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
})
class VerifyChannelBackfillModule {}

async function main(): Promise<void> {
  console.log('EVCore - verify channel backfill (gate)');

  const app = await NestFactory.createApplicationContext(
    VerifyChannelBackfillModule,
    { logger: ['error', 'warn'] },
  );
  const prisma = app.get(PrismaService);

  const report = await verifyBackfill(prisma.client);

  for (const check of report.checks) {
    const flag = check.ok ? 'PASS' : 'FAIL';
    console.log(`[${flag}] ${check.name} ${JSON.stringify(check.details)}`);
  }
  console.log(`\nGate: ${report.ok ? 'GREEN ✅' : 'RED ❌'}`);

  await app.close();
  if (!report.ok) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
