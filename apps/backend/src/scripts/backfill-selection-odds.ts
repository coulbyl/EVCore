/**
 * Backfill odds / impliedProbability / EV on historical channel_selection rows.
 *
 * Why: BTTS and DOMINANT strategies used to emit selections WITHOUT attaching
 * the market price (fixed going-forward — see strategies/selection-odds.ts), so
 * their existing channel_selection rows have odds = NULL and EV is unmeasurable.
 * This recomputes those fields from OddsSnapshot using the engine's own odds
 * resolver (loadFullOddsSnapshot) + the shared priceForSelection helper, so the
 * backfilled values match exactly what new runs now produce.
 *
 * Dev-only: in prod the engine re-analyses everything, so this is not needed.
 *
 * Run after build:
 *   cd apps/backend
 *   pnpm build
 *   node dist/scripts/backfill-selection-odds.js --dry-run
 *   node dist/scripts/backfill-selection-odds.js
 *   node dist/scripts/backfill-selection-odds.js --limit 500
 */

// Must run before any import that initialises the Prisma client (@evcore/db),
// so DATABASE_URL is loaded from .env — same as src/main.ts.
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { NestFactory } from '@nestjs/core';
import Decimal from 'decimal.js';
import { PrismaModule } from '@/prisma.module';
import { PrismaService } from '@/prisma.service';
import { BettingEngineModule } from '@modules/betting-engine/betting-engine.module';
import { BettingEngineService } from '@modules/betting-engine/betting-engine.service';
import {
  priceSelection,
  resolveSelectionOdds,
} from '@modules/betting-engine/strategies/selection-odds';
import type { FullOddsSnapshot } from '@modules/betting-engine/betting-engine.types';

type ScriptArgs = { limit: number | null; dryRun: boolean };

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    PrismaModule,
    BettingEngineModule,
  ],
})
class BackfillSelectionOddsModule {}

function parseArgs(argv: string[]): ScriptArgs {
  const args: ScriptArgs = { limit: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--limit') {
      const value = Number.parseInt(argv[i + 1] ?? '', 10);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error('--limit must be a positive integer');
      }
      args.limit = value;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node dist/scripts/backfill-selection-odds.js [--dry-run] [--limit N]',
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `EVCore - backfill channel_selection odds (dryRun=${args.dryRun}, limit=${args.limit ?? 'ALL'})`,
  );

  const app = await NestFactory.createApplicationContext(
    BackfillSelectionOddsModule,
    { logger: ['error', 'warn'] },
  );
  const prisma = app.get(PrismaService);
  const engine = app.get(BettingEngineService);

  const selections = await prisma.client.channelSelection.findMany({
    where: { odds: null },
    select: {
      id: true,
      market: true,
      pick: true,
      probability: true,
      channelDecision: {
        select: {
          channel: true,
          modelRun: {
            select: { fixture: { select: { id: true, scheduledAt: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    ...(args.limit !== null ? { take: args.limit } : {}),
  });

  console.log(`Candidate selections (odds NULL): ${selections.length}`);

  // One FullOddsSnapshot per fixture (built at kickoff cutoff), cached.
  const oddsCache = new Map<string, FullOddsSnapshot | null>();
  const perChannel = new Map<string, { priced: number; noPrice: number }>();
  let priced = 0;
  let noPrice = 0;

  for (let i = 0; i < selections.length; i += 1) {
    const sel = selections[i];
    const fixture = sel.channelDecision.modelRun.fixture;
    const channel = sel.channelDecision.channel;
    const bucket = perChannel.get(channel) ?? { priced: 0, noPrice: 0 };

    let full = oddsCache.get(fixture.id);
    if (full === undefined) {
      full = await engine.loadFullOddsSnapshot(fixture.id, fixture.scheduledAt);
      oddsCache.set(fixture.id, full);
    }

    const odds = resolveSelectionOdds(full, sel.market, sel.pick);
    const priceFields = priceSelection({
      probability: new Decimal(sel.probability.toString()),
      odds,
    });

    if (priceFields.odds === undefined) {
      noPrice += 1;
      bucket.noPrice += 1;
      perChannel.set(channel, bucket);
      continue;
    }

    priced += 1;
    bucket.priced += 1;
    perChannel.set(channel, bucket);

    if (!args.dryRun) {
      await prisma.client.channelSelection.update({
        where: { id: sel.id },
        data: {
          odds: priceFields.odds.toFixed(3),
          impliedProbability: priceFields.impliedProbability?.toFixed(4),
          ev: priceFields.ev?.toFixed(4),
        },
      });
    }

    if ((i + 1) % 500 === 0 || i + 1 === selections.length) {
      console.log(
        `Progress ${i + 1}/${selections.length}: priced=${priced}, noPrice=${noPrice}`,
      );
    }
  }

  console.log(`\nDone${args.dryRun ? ' (dry-run, no writes)' : ''}`);
  console.log(`Priced (updated): ${priced}`);
  console.log(`No price found  : ${noPrice}`);
  for (const [channel, stats] of [...perChannel.entries()].sort()) {
    console.log(
      `  ${channel}: priced=${stats.priced}, noPrice=${stats.noPrice}`,
    );
  }

  await app.close();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
