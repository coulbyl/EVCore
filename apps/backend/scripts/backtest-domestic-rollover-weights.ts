/**
 * Read-only Brier scan for DOMESTIC_SEASON_ROLLOVER_FORM_WEIGHT/XG_WEIGHT
 * (betting-engine/ev.constants.ts) — the season-rollover fallback added
 * 2026-08-07 (see memory project_season_rollover_teamstats_gap.md).
 *
 * Never writes to the DB (no analyzeFixture, no model_run/bet mutation —
 * unlike scripts/reanalyze-scope.ts, which is dev-only for exactly that
 * reason). Only re-derives 1X2 probabilities in memory from the same pure
 * functions betting-engine.service.ts uses, for every historical fixture
 * where at least one side had a thin current-season sample
 * (< DOMESTIC_SEASON_ROLLOVER_MIN_GAMES teamStats rows), across a grid of
 * candidate weights, and scores each grid point with brierScoreOneXTwo.
 *
 * Methodology mirrors the WC 2022 scan referenced in ev.constants.ts
 * (NATIONAL_TEAM_CROSS_COMP_*): same Brier-on-1X2 metric, same "does trusting
 * the thin current-season sample fully beat blending it with the fallback"
 * question — just for domestic leagues' season rollover instead of a
 * tournament's opening fixtures.
 *
 * Run: cd apps/backend && ./node_modules/.bin/tsx --env-file=.env scripts/backtest-domestic-rollover-weights.ts
 */

import { prisma } from '@evcore/db';
import {
  blendTeamStats,
  buildLambdaConfig,
  buildMatchupFeatures,
  deriveLambdas,
  rebalanceThreeWayProbabilities,
  shrinkOverUnderProbabilities,
  getOverUnderShrinkageConfig,
  type TeamStatsInput,
} from '@modules/betting-engine/math/probability';
import { computePoissonMarkets } from '@modules/betting-engine/betting-engine.utils';
import { getLeagueThreeWayEmpiricalBlendWeight } from '@modules/betting-engine/ev.constants';
import {
  brierScoreOneXTwo,
  getOneXTwoOutcome,
  type OneXTwoPrediction,
} from '@modules/backtest/backtest.report';

// Competitions excluded from the domestic-rollover fallback branch itself
// (European club comps handled by their own EUROPEAN_CROSS_COMP_* weights;
// national-team comps by NATIONAL_TEAM_CROSS_COMP_*; FRI has its own model).
const NON_DOMESTIC_CODES = new Set([
  'UCL',
  'UEL',
  'UECL',
  'LDC',
  'WC',
  'WCQE',
  'WCQCA',
  'WCQSA',
  'WCQAS',
  'WCQAF',
  'WCQOC',
  'UNL',
  'CAN',
  'COPA',
  'FRI',
]);

const MIN_GAMES = 3; // mirrors DOMESTIC_SEASON_ROLLOVER_MIN_GAMES

// Weight candidates for formWeight/xgWeight (primary=current thin sample,
// secondary=cross-season fallback). 0 = fully trust the fallback, 1 = fully
// trust the current thin sample (equivalent to no blending at all).
const WEIGHT_GRID = [0, 0.2, 0.35, 0.5, 0.65, 0.8, 1.0];

type FixtureRow = {
  id: string;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: Date;
  homeScore: number;
  awayScore: number;
  competitionCode: string;
};

function toTeamStatsInput(row: {
  recentForm: unknown;
  xgFor: unknown;
  xgAgainst: unknown;
  homeWinRate: unknown;
  awayWinRate: unknown;
  drawRate: unknown;
  leagueVolatility: unknown;
}): TeamStatsInput {
  return row;
}

async function findCrossCompStats(
  teamId: string,
  beforeDate: Date,
  excludeSeasonId: string,
): Promise<TeamStatsInput | null> {
  const row = await prisma.teamStats.findFirst({
    where: {
      teamId,
      afterFixture: {
        scheduledAt: { lt: beforeDate },
        seasonId: { not: excludeSeasonId },
      },
    },
    orderBy: { afterFixture: { scheduledAt: 'desc' } },
  });
  return row ? toTeamStatsInput(row) : null;
}

function computeOneXTwo(
  homeStats: TeamStatsInput,
  awayStats: TeamStatsInput,
  competitionCode: string,
) {
  const lambda = deriveLambdas(
    homeStats,
    awayStats,
    buildLambdaConfig(competitionCode),
  );
  const raw = computePoissonMarkets(lambda.home, lambda.away);
  const rebalanced = rebalanceThreeWayProbabilities({
    probabilities: raw,
    homeStats,
    awayStats,
    blendWeight: getLeagueThreeWayEmpiricalBlendWeight(competitionCode),
  });
  const final = shrinkOverUnderProbabilities(
    rebalanced,
    getOverUnderShrinkageConfig(competitionCode),
  );
  return {
    home: final.home.toNumber(),
    draw: final.draw.toNumber(),
    away: final.away.toNumber(),
  };
}

async function main(): Promise<void> {
  console.log('EVCore — DOMESTIC_SEASON_ROLLOVER weight scan (read-only)\n');

  const fixtures = await prisma.fixture.findMany({
    where: {
      status: 'FINISHED',
      homeScore: { not: null },
      awayScore: { not: null },
      season: { competition: { code: { notIn: [...NON_DOMESTIC_CODES] } } },
    },
    select: {
      id: true,
      seasonId: true,
      homeTeamId: true,
      awayTeamId: true,
      scheduledAt: true,
      homeScore: true,
      awayScore: true,
      season: { select: { competition: { select: { code: true } } } },
    },
    orderBy: { scheduledAt: 'asc' },
  });

  console.log(`Domestic FINISHED fixtures in scope: ${fixtures.length}`);

  const rows: FixtureRow[] = fixtures.map((f) => ({
    id: f.id,
    seasonId: f.seasonId,
    homeTeamId: f.homeTeamId,
    awayTeamId: f.awayTeamId,
    scheduledAt: f.scheduledAt,
    homeScore: f.homeScore as number,
    awayScore: f.awayScore as number,
    competitionCode: f.season.competition.code,
  }));

  // Per-grid-point accumulator: predictions across every qualifying fixture.
  const predictionsByWeight = new Map<string, OneXTwoPrediction[]>();
  for (const fw of WEIGHT_GRID) {
    for (const xw of WEIGHT_GRID) {
      predictionsByWeight.set(`${fw}/${xw}`, []);
    }
  }
  // Baseline: current thin sample used as-is, no fallback at all — only
  // computable when both sides already have a (thin) current-season sample;
  // when one side is null there's nothing to use without the fallback, so
  // this baseline's sample is a strict subset of the weight grid's.
  const noFallbackPredictions: OneXTwoPrediction[] = [];

  let qualifying = 0;
  let bothSidesRecoverable = 0;
  let unrecoverable = 0;
  let processed = 0;

  for (const fixture of rows) {
    processed += 1;
    if (processed % 2000 === 0) {
      console.log(`… ${processed}/${rows.length} fixtures scanned`);
    }

    const [homeGamesPlayed, awayGamesPlayed] = await Promise.all([
      prisma.teamStats.count({
        where: {
          teamId: fixture.homeTeamId,
          afterFixture: {
            seasonId: fixture.seasonId,
            scheduledAt: { lt: fixture.scheduledAt },
          },
        },
      }),
      prisma.teamStats.count({
        where: {
          teamId: fixture.awayTeamId,
          afterFixture: {
            seasonId: fixture.seasonId,
            scheduledAt: { lt: fixture.scheduledAt },
          },
        },
      }),
    ]);

    const homeThin = homeGamesPlayed < MIN_GAMES;
    const awayThin = awayGamesPlayed < MIN_GAMES;
    if (!homeThin && !awayThin) continue; // not in the fallback's scope

    qualifying += 1;

    const [homeStatsRow, awayStatsRow] = await Promise.all([
      prisma.teamStats.findFirst({
        where: {
          teamId: fixture.homeTeamId,
          afterFixture: {
            seasonId: fixture.seasonId,
            scheduledAt: { lt: fixture.scheduledAt },
          },
        },
        orderBy: { afterFixture: { scheduledAt: 'desc' } },
      }),
      prisma.teamStats.findFirst({
        where: {
          teamId: fixture.awayTeamId,
          afterFixture: {
            seasonId: fixture.seasonId,
            scheduledAt: { lt: fixture.scheduledAt },
          },
        },
        orderBy: { afterFixture: { scheduledAt: 'desc' } },
      }),
    ]);
    const homeStats = homeStatsRow ? toTeamStatsInput(homeStatsRow) : null;
    const awayStats = awayStatsRow ? toTeamStatsInput(awayStatsRow) : null;

    const [homeCross, awayCross] = await Promise.all([
      homeThin
        ? findCrossCompStats(
            fixture.homeTeamId,
            fixture.scheduledAt,
            fixture.seasonId,
          )
        : null,
      awayThin
        ? findCrossCompStats(
            fixture.awayTeamId,
            fixture.scheduledAt,
            fixture.seasonId,
          )
        : null,
    ]);

    // Same "would still be skipped" check as production (line ~633 of
    // betting-engine.service.ts) — exclude fixtures the fallback can't
    // rescue anyway (no cross-season data either, e.g. a genuinely new team).
    const homeResolved = homeThin ? homeCross : homeStats;
    const awayResolved = awayThin ? awayCross : awayStats;
    if (!homeResolved || !awayResolved) {
      unrecoverable += 1;
      continue;
    }
    bothSidesRecoverable += 1;

    const actual = getOneXTwoOutcome(fixture.homeScore, fixture.awayScore);

    // No-fallback baseline: only valid if both sides already had *some*
    // current-season sample (not null) even if thin.
    if (homeStats && awayStats) {
      const probs = computeOneXTwo(
        homeStats,
        awayStats,
        fixture.competitionCode,
      );
      noFallbackPredictions.push({ ...probs, actual });
    }

    for (const fw of WEIGHT_GRID) {
      for (const xw of WEIGHT_GRID) {
        const effHome =
          homeThin && homeCross
            ? homeStats
              ? blendTeamStats({
                  primary: homeStats,
                  secondary: homeCross,
                  formWeight: fw,
                  xgWeight: xw,
                })
              : homeCross
            : (homeStats as TeamStatsInput);
        const effAway =
          awayThin && awayCross
            ? awayStats
              ? blendTeamStats({
                  primary: awayStats,
                  secondary: awayCross,
                  formWeight: fw,
                  xgWeight: xw,
                })
              : awayCross
            : (awayStats as TeamStatsInput);

        const probs = computeOneXTwo(effHome, effAway, fixture.competitionCode);
        predictionsByWeight.get(`${fw}/${xw}`)!.push({ ...probs, actual });
      }
    }
  }

  console.log(
    `\nScanned ${processed} fixtures — ${qualifying} in fallback scope ` +
      `(${bothSidesRecoverable} recoverable, ${unrecoverable} unrecoverable ` +
      `by either the fallback or a no-fallback baseline).\n`,
  );

  if (noFallbackPredictions.length > 0) {
    const brier = brierScoreOneXTwo(noFallbackPredictions);
    console.log(
      `Baseline — trust the thin current-season sample, no fallback at all ` +
        `(n=${noFallbackPredictions.length}): Brier = ${brier.toFixed(5)}`,
    );
  } else {
    console.log(
      'Baseline — no fallback: no fixtures had a non-null thin sample on both sides.',
    );
  }
  console.log('');

  const results: { fw: number; xw: number; n: number; brier: number }[] = [];
  for (const fw of WEIGHT_GRID) {
    for (const xw of WEIGHT_GRID) {
      const preds = predictionsByWeight.get(`${fw}/${xw}`)!;
      results.push({
        fw,
        xw,
        n: preds.length,
        brier: brierScoreOneXTwo(preds),
      });
    }
  }
  results.sort((a, b) => a.brier - b.brier);

  console.log('formWeight  xgWeight  n      brier');
  for (const r of results) {
    console.log(
      `${r.fw.toFixed(2).padEnd(11)} ${r.xw.toFixed(2).padEnd(9)} ${String(r.n).padEnd(6)} ${r.brier.toFixed(5)}`,
    );
  }

  console.log(
    `\nBest: formWeight=${results[0].fw}, xgWeight=${results[0].xw} (Brier=${results[0].brier.toFixed(5)})`,
  );

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
