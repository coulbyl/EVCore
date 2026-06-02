/**
 * Generate local betting-engine picks for historical seasons.
 *
 * This script intentionally uses the real BettingEngineService so it writes the
 * same model_run, bet and prediction rows as production analysis. For finished
 * fixtures, it settles bets and predictions immediately from the stored score.
 *
 * Run after build:
 *   cd apps/backend
 *   pnpm build
 *   node dist/scripts/generate-season-picks.js --season-name 2025-26 --limit 20
 *   node dist/scripts/generate-season-picks.js --season-name 2025-26
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { NestFactory } from '@nestjs/core';
import { FixtureStatus } from '@evcore/db';
import { PrismaModule } from '@/prisma.module';
import { BettingEngineModule } from '@modules/betting-engine/betting-engine.module';
import { BettingEngineService } from '@modules/betting-engine/betting-engine.service';
import { PredictionModule } from '@modules/prediction/prediction.module';
import { PredictionService } from '@modules/prediction/prediction.service';
import { PrismaService } from '@/prisma.service';

type ScriptArgs = {
  seasonName: string | null;
  competitionCode: string | null;
  from: string | null;
  to: string | null;
  limit: number | null;
  offset: number;
  dryRun: boolean;
  skipExisting: boolean;
};

type SeasonScope = {
  id: string;
  name: string;
  competition: {
    code: string;
    name: string;
  };
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
    PredictionModule,
  ],
})
class GenerateSeasonPicksModule {}

function parseArgs(argv: string[]): ScriptArgs {
  const args: ScriptArgs = {
    seasonName: '2025-26',
    competitionCode: null,
    from: null,
    to: null,
    limit: null,
    offset: 0,
    dryRun: false,
    skipExisting: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === '--season-name') {
      args.seasonName = requireValue(arg, next);
      i += 1;
    } else if (arg === '--all-seasons') {
      args.seasonName = null;
    } else if (arg === '--competition') {
      args.competitionCode = requireValue(arg, next).toUpperCase();
      i += 1;
    } else if (arg === '--from') {
      args.from = requireIsoDate(arg, next);
      i += 1;
    } else if (arg === '--to') {
      args.to = requireIsoDate(arg, next);
      i += 1;
    } else if (arg === '--limit') {
      args.limit = parsePositiveInt(arg, next);
      i += 1;
    } else if (arg === '--offset') {
      args.offset = parseNonNegativeInt(arg, next);
      i += 1;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--skip-existing') {
      args.skipExisting = true;
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
  if (!value?.trim()) {
    throw new Error(`${name} requires a value`);
  }
  return value.trim();
}

function parsePositiveInt(name: string, value: string | undefined): number {
  const parsed = Number.parseInt(requireValue(name, value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeInt(name: string, value: string | undefined): number {
  const parsed = Number.parseInt(requireValue(name, value), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
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
  node dist/scripts/generate-season-picks.js [options]

Options:
  --season-name NAME       Season name to replay. Default: 2025-26
  --all-seasons            Ignore season name filter
  --competition CODE       Optional competition code, e.g. PL, SP2, J1
  --from YYYY-MM-DD        Optional scheduledAt lower bound
  --to YYYY-MM-DD          Optional scheduledAt upper bound
  --limit N                Limit fixtures, useful for a pilot run
  --offset N               Skip first N fixtures after ordering
  --dry-run                Print scope without writing model_run/bet rows
  --skip-existing          Skip fixtures that already have at least one model_run
  --help                   Show this message`);
}

async function loadSeasons(
  prisma: PrismaService,
  args: ScriptArgs,
): Promise<SeasonScope[]> {
  return prisma.client.season.findMany({
    where: {
      ...(args.seasonName !== null ? { name: args.seasonName } : {}),
      ...(args.competitionCode
        ? { competition: { code: args.competitionCode } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      competition: {
        select: {
          code: true,
          name: true,
        },
      },
    },
    orderBy: [{ competition: { code: 'asc' } }, { name: 'asc' }],
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log('EVCore - generate historical season picks');
  console.log(
    `Scope: season=${args.seasonName ?? 'ALL'}, competition=${args.competitionCode ?? 'ALL'}, from=${args.from ?? 'MIN'}, to=${args.to ?? 'MAX'}, limit=${args.limit ?? 'ALL'}, offset=${args.offset}, dryRun=${args.dryRun}, skipExisting=${args.skipExisting}`,
  );

  const app = await NestFactory.createApplicationContext(
    GenerateSeasonPicksModule,
    { logger: ['error', 'warn'] },
  );

  const prisma = app.get(PrismaService);
  const bettingEngine = app.get(BettingEngineService);
  const predictionService = app.get(PredictionService);

  const seasons = await loadSeasons(prisma, args);
  if (seasons.length === 0) {
    throw new Error('No season matched the requested scope.');
  }

  const seasonIds = seasons.map((season) => season.id);
  const fixtures = await prisma.client.fixture.findMany({
    where: {
      seasonId: { in: seasonIds },
      status: FixtureStatus.FINISHED,
      ...(args.skipExisting ? { modelRuns: { none: {} } } : {}),
      scheduledAt: {
        ...(args.from !== null
          ? { gte: new Date(`${args.from}T00:00:00.000Z`) }
          : {}),
        ...(args.to !== null
          ? { lte: new Date(`${args.to}T23:59:59.999Z`) }
          : {}),
      },
    },
    select: {
      id: true,
      scheduledAt: true,
      homeScore: true,
      awayScore: true,
      season: {
        select: {
          name: true,
          competition: { select: { code: true } },
        },
      },
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      _count: { select: { modelRuns: true } },
    },
    orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    skip: args.offset,
    ...(args.limit !== null ? { take: args.limit } : {}),
  });

  console.log(`Matched seasons: ${seasons.length}`);
  for (const season of seasons) {
    console.log(
      `- ${season.competition.code} ${season.name}: ${season.competition.name}`,
    );
  }
  console.log(`Fixtures to process: ${fixtures.length}`);

  if (args.dryRun) {
    for (const fixture of fixtures.slice(0, 20)) {
      console.log(
        `- ${fixture.scheduledAt.toISOString().slice(0, 10)} ${fixture.season.competition.code} ${fixture.homeTeam.name} vs ${fixture.awayTeam.name} modelRuns=${fixture._count.modelRuns}`,
      );
    }
    await app.close();
    return;
  }

  let analyzed = 0;
  let skipped = 0;
  let settledBets = 0;
  let settledPredictions = 0;

  for (let i = 0; i < fixtures.length; i += 1) {
    const fixture = fixtures[i];
    const result = await bettingEngine.analyzeFixture(fixture.id);
    if (result.status === 'analyzed') analyzed += 1;
    else skipped += 1;

    const betSettlement = await bettingEngine.settleOpenBets(fixture.id);
    settledBets += betSettlement.settled;

    const predictionSettlement = await predictionService.settlePredictions(
      fixture.id,
      fixture.homeScore,
      fixture.awayScore,
    );
    settledPredictions += predictionSettlement.settled;

    if ((i + 1) % 100 === 0 || i + 1 === fixtures.length) {
      console.log(
        `Progress ${i + 1}/${fixtures.length}: analyzed=${analyzed}, skipped=${skipped}, settledBets=${settledBets}, settledPredictions=${settledPredictions}`,
      );
    }
  }

  console.log('\nDone');
  console.log(`Analyzed fixtures     : ${analyzed}`);
  console.log(`Skipped fixtures      : ${skipped}`);
  console.log(`Settled bet rows      : ${settledBets}`);
  console.log(`Settled prediction rows: ${settledPredictions}`);

  await app.close();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
