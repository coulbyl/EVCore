/**
 * Re-analyse a bounded scope of FINISHED fixtures with the CURRENT engine code,
 * then re-settle their channel selections — so the read-only backtests
 * (/backtest/*) reflect code changes (edge floor, HT split, per-league config…).
 *
 * Why a wipe first: analyzeFixture always does modelRun.create, so re-running
 * without deleting duplicates every model_run / channel_decision / channel_selection
 * and the backtest would double-count. FK delete order (all RESTRICT upward):
 *   bet → channel_selection → channel_decision → model_run.
 * Deleting a bet cascades its bet_slip_item and nulls bankroll_transaction.betId.
 *
 * Dev-only. Run after build:
 *   cd apps/backend && pnpm build
 *   node dist/src/scripts/reanalyze-scope.js --competition WC --dry-run
 *   node dist/src/scripts/reanalyze-scope.js --competition WC
 *   node dist/src/scripts/reanalyze-scope.js --season <seasonId>
 *   node dist/src/scripts/reanalyze-scope.js --from 2025-07-01 --to 2026-06-30
 *   node dist/src/scripts/reanalyze-scope.js --season-name "2024-25,2025,2025-26,2026,2026-27" --dry-run
 */

// Must run before any import that initialises the Prisma client (@evcore/db).
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { NestFactory } from '@nestjs/core';
import { FixtureStatus, type Prisma } from '@evcore/db';
import { PrismaModule } from '@/prisma.module';
import { PrismaService } from '@/prisma.service';
import { BettingEngineModule } from '@modules/betting-engine/betting-engine.module';
import { BettingEngineService } from '@modules/betting-engine/betting-engine.service';
import { ChannelDecisionService } from '@modules/betting-engine/channel-decision.service';

type ScriptArgs = {
  competition: string | null;
  season: string | null;
  seasonNames: string[] | null;
  from: string | null;
  to: string | null;
  dryRun: boolean;
};

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
class ReanalyzeScopeModule {}

function parseArgs(argv: string[]): ScriptArgs {
  const args: ScriptArgs = {
    competition: null,
    season: null,
    seasonNames: null,
    from: null,
    to: null,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--competition') args.competition = argv[(i += 1)] ?? null;
    else if (arg === '--season') args.season = argv[(i += 1)] ?? null;
    else if (arg === '--season-name') {
      const value = argv[(i += 1)] ?? null;
      args.seasonNames = value ? value.split(',').map((s) => s.trim()) : null;
    } else if (arg === '--from') args.from = argv[(i += 1)] ?? null;
    else if (arg === '--to') args.to = argv[(i += 1)] ?? null;
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node dist/scripts/reanalyze-scope.js (--competition CODE | --season ID | --season-name "2025-26,2026") [--from D --to D] [--dry-run]',
      );
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.competition && !args.season && !args.seasonNames && !args.from) {
    throw new Error(
      'Provide --competition, --season, --season-name, or --from/--to',
    );
  }
  return args;
}

function buildFixtureWhere(args: ScriptArgs): Prisma.FixtureWhereInput {
  const where: Prisma.FixtureWhereInput = { status: FixtureStatus.FINISHED };
  if (args.season) where.seasonId = args.season;
  // Season LABELS (e.g. "2025-26") repeat across every competition — unlike
  // --season (one seasonId, one competition), this matches all of them at
  // once. Deliberately NOT a scheduledAt date range: some season labels
  // (multi-year qualification cycles) span years wider than their label
  // suggests, so filtering by date would silently pull in unrelated history.
  if (args.seasonNames || args.competition) {
    where.season = {
      ...(args.seasonNames ? { name: { in: args.seasonNames } } : {}),
      ...(args.competition ? { competition: { code: args.competition } } : {}),
    };
  }
  if (args.from || args.to) {
    where.scheduledAt = {
      ...(args.from ? { gte: new Date(`${args.from}T00:00:00.000Z`) } : {}),
      ...(args.to ? { lte: new Date(`${args.to}T23:59:59.999Z`) } : {}),
    };
  }
  return where;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const scopeParts = [
    args.competition ? `competition=${args.competition}` : null,
    args.season ? `season=${args.season}` : null,
    args.seasonNames ? `seasonNames=${args.seasonNames.join('|')}` : null,
    args.from || args.to ? `${args.from ?? '…'}→${args.to ?? '…'}` : null,
  ].filter((p): p is string => p !== null);
  const scope = scopeParts.join(', ');
  console.log(`EVCore — reanalyze scope (${scope}, dryRun=${args.dryRun})`);

  const app = await NestFactory.createApplicationContext(ReanalyzeScopeModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const engine = app.get(BettingEngineService);
  const channelDecisions = app.get(ChannelDecisionService, { strict: false });

  const fixtureWhere = buildFixtureWhere(args);
  const fixtures = await prisma.client.fixture.findMany({
    where: fixtureWhere,
    select: {
      id: true,
      homeScore: true,
      awayScore: true,
      homeHtScore: true,
      awayHtScore: true,
    },
    orderBy: { scheduledAt: 'asc' },
  });
  console.log(`Fixtures in scope: ${fixtures.length}`);

  if (args.dryRun) {
    const [runs, decisions, selections, bets] = await Promise.all([
      prisma.client.modelRun.count({ where: { fixture: fixtureWhere } }),
      prisma.client.channelDecision.count({
        where: { modelRun: { fixture: fixtureWhere } },
      }),
      prisma.client.channelSelection.count({
        where: { channelDecision: { modelRun: { fixture: fixtureWhere } } },
      }),
      prisma.client.bet.count({
        where: { modelRun: { fixture: fixtureWhere } },
      }),
    ]);
    console.log(
      `Would delete → bets:${bets} selections:${selections} decisions:${decisions} modelRuns:${runs}, then re-analyse ${fixtures.length} fixtures.`,
    );
    await app.close();
    return;
  }

  // 1) Wipe existing analysis for the scope (FK-safe order).
  const delBets = await prisma.client.bet.deleteMany({
    where: { modelRun: { fixture: fixtureWhere } },
  });
  const delSel = await prisma.client.channelSelection.deleteMany({
    where: { channelDecision: { modelRun: { fixture: fixtureWhere } } },
  });
  const delDec = await prisma.client.channelDecision.deleteMany({
    where: { modelRun: { fixture: fixtureWhere } },
  });
  const delRuns = await prisma.client.modelRun.deleteMany({
    where: { fixture: fixtureWhere },
  });
  console.log(
    `Wiped → bets:${delBets.count} selections:${delSel.count} decisions:${delDec.count} modelRuns:${delRuns.count}`,
  );

  // 2) Re-analyse + 3) re-settle, per fixture.
  let analyzed = 0;
  let settled = 0;
  let skipped = 0;
  for (let i = 0; i < fixtures.length; i += 1) {
    const f = fixtures[i];
    const res = await engine.analyzeFixture(f.id);
    if (res.status === 'analyzed') analyzed += 1;
    else skipped += 1;

    if (f.homeScore !== null && f.awayScore !== null) {
      const out = await channelDecisions.settleFixtureSelections({
        fixtureId: f.id,
        scores: {
          homeScore: f.homeScore,
          awayScore: f.awayScore,
          homeHtScore: f.homeHtScore,
          awayHtScore: f.awayHtScore,
        },
        mode: 'final',
      });
      settled += out.settled;
    }
    if ((i + 1) % 200 === 0) {
      console.log(`… ${i + 1}/${fixtures.length} (settled ${settled})`);
    }
  }
  console.log(
    `Done → analyzed:${analyzed} skipped:${skipped} settledSelections:${settled}`,
  );
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
