/**
 * CLI wrapper around the channel-decision backfill (logic in
 * backfill-channel-decisions.lib.ts). Idempotent and transactional.
 *
 * Run after build:
 *   cd apps/backend
 *   pnpm build
 *   node dist/scripts/backfill-channel-decisions.js --dry-run
 *   node dist/scripts/backfill-channel-decisions.js
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaModule } from '@/prisma.module';
import { PrismaService } from '@/prisma.service';
import {
  runBackfill,
  type BackfillArgs,
} from './backfill-channel-decisions.lib';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
})
class BackfillChannelDecisionsModule {}

function parseArgs(argv: string[]): BackfillArgs {
  const args: BackfillArgs = {
    from: null,
    to: null,
    limit: null,
    batchSize: 500,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === '--from') {
      args.from = requireIsoDate(arg, next);
      i += 1;
    } else if (arg === '--to') {
      args.to = requireIsoDate(arg, next);
      i += 1;
    } else if (arg === '--limit') {
      args.limit = parsePositiveInt(arg, next);
      i += 1;
    } else if (arg === '--batch-size') {
      args.batchSize = parsePositiveInt(arg, next);
      i += 1;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function requireValue(name: string, value: string | undefined): string {
  if (!value?.trim()) throw new Error(`${name} requires a value`);
  return value.trim();
}

function parsePositiveInt(name: string, value: string | undefined): number {
  const parsed = Number.parseInt(requireValue(name, value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function requireIsoDate(name: string, value: string | undefined): string {
  const date = requireValue(name, value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`${name} must be an ISO date YYYY-MM-DD`);
  }
  return date;
}

function printHelp(): void {
  console.log(`Usage:
  node dist/scripts/backfill-channel-decisions.js [options]

Options:
  --from YYYY-MM-DD     Only runs whose fixture scheduledAt >= this date
  --to YYYY-MM-DD       Only runs whose fixture scheduledAt <= this date
  --limit N             Cap the number of ModelRuns processed (pilot run)
  --batch-size N        ModelRuns loaded per batch. Default: 500
  --dry-run             Count what would be written, write nothing
  --help                Show this message`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log('EVCore - backfill channel decisions');
  console.log(
    `Scope: from=${args.from ?? 'MIN'}, to=${args.to ?? 'MAX'}, limit=${args.limit ?? 'ALL'}, batchSize=${args.batchSize}, dryRun=${args.dryRun}`,
  );

  const app = await NestFactory.createApplicationContext(
    BackfillChannelDecisionsModule,
    {
      logger: ['error', 'warn'],
    },
  );
  const prisma = app.get(PrismaService);

  const stats = await runBackfill({
    db: prisma.client,
    args,
    onProgress: (processed, target) =>
      console.log(`Progress ${processed}/${target}`),
  });

  console.log('\nDone');
  console.log(`Runs processed (wrote ≥1) : ${stats.runsProcessed}`);
  console.log(`Runs skipped (idempotent) : ${stats.runsSkippedFully}`);
  console.log(`EV   SELECTED decisions   : ${stats.evSelected}`);
  console.log(`EV   REJECTED decisions   : ${stats.evRejected}`);
  console.log(`SAFE SELECTED decisions   : ${stats.safeSelected}`);
  console.log(`Prediction SELECTED       : ${stats.predictionSelected}`);
  console.log(`Bets linked to selections : ${stats.betsLinked}`);

  await app.close();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
