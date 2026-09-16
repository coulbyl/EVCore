import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyReliability,
  composeDeterministicCoupon,
  fitReliability,
  shrinkTowardPooled,
  type ChannelReliability,
  type CouponBounds,
  type CouponClass,
  type CouponLeg,
} from "@evcore/analysis-core";
import { Prisma, prisma } from "@evcore/db";

const POLICY_VERSION = "league-market-close-v1";
const MIN_TRAIN_OBSERVATIONS = 100;
const MIN_VALIDATION_OBSERVATIONS = 40;
const MIN_BRIER_IMPROVEMENT = 0.001;
const LEAGUE_PRIOR_WEIGHT = 250;
const MIN_LEG_ODDS = 1.3;
const MAX_LEG_ODDS = 3.5;
const MAX_POSITIVE_EDGE = 0.1;
const MIN_CONFIG_COUPONS = 100;

// Set only after running and committing the development phase. The holdout
// command refuses to run while this remains null.
const FROZEN_CONFIG_NAME: string | null = null;

type RawObservation = {
  fixtureId: string;
  scheduledAt: Date;
  seasonName: string;
  seasonStart: Date;
  competition: string;
  market: string;
  pick: string;
  odds: Prisma.Decimal;
  fairProbability: number;
  won: boolean;
};

type Observation = Omit<RawObservation, "odds"> & { odds: number };

type SeasonSplit = {
  train: Observation[];
  validation: Observation[];
  holdout: Observation[];
  trainSeasons: string[];
  validationSeason: string;
  holdoutSeason: string;
};

type Stratum = {
  key: string;
  competition: string;
  market: string;
  pick: string;
  trainN: number;
  validationN: number;
  marketBrier: number;
  calibratedBrier: number;
  brierImprovement: number;
  reliability: ChannelReliability;
};

type ComposerConfig = {
  name: string;
  minEdge: number;
  maxLegs: number;
  maxCombinedOdds: number;
};

type EvaluatedCoupon = {
  day: string;
  outcome: "WON" | "LOST" | "ABSTAINED";
  profit: number;
  combinedOdds: number | null;
  legs: Array<{
    fixtureId: string;
    competition: string;
    market: string;
    pick: string;
    probability: number;
    fairProbability: number;
    edge: number;
    odds: number;
    won: boolean;
  }>;
};

const CONFIGS: readonly ComposerConfig[] = [0.01, 0.02, 0.03].flatMap(
  (minEdge) =>
    [3, 4, 5].flatMap((maxLegs) =>
      [7, 10, 15].map((maxCombinedOdds) => ({
        name: `edge${String(Math.round(minEdge * 100)).padStart(2, "0")}-legs${maxLegs}-odds${maxCombinedOdds}`,
        minEdge,
        maxLegs,
        maxCombinedOdds,
      })),
    ),
);

function groupBy<T>(
  values: readonly T[],
  keyFor: (value: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyFor(value);
    const group = groups.get(key) ?? [];
    group.push(value);
    groups.set(key, group);
  }
  return groups;
}

function marketKey(value: Pick<Observation, "market" | "pick">): string {
  return `${value.market}:${value.pick}`;
}

function stratumKey(
  value: Pick<Observation, "competition" | "market" | "pick">,
): string {
  return `${value.competition}:${marketKey(value)}`;
}

function brier(
  observations: readonly Observation[],
  probabilityFor: (observation: Observation) => number,
): number {
  return (
    observations.reduce((sum, observation) => {
      const error = probabilityFor(observation) - (observation.won ? 1 : 0);
      return sum + error * error;
    }, 0) / observations.length
  );
}

function fitByMarket(observations: readonly Observation[]) {
  return new Map(
    [...groupBy(observations, marketKey)].map(([key, rows]) => [
      key,
      fitReliability(
        rows.map((row) => ({
          probability: row.fairProbability,
          won: row.won,
        })),
      ),
    ]),
  );
}

function splitByCompetition(
  observations: readonly Observation[],
): Map<string, SeasonSplit> {
  const result = new Map<string, SeasonSplit>();
  for (const [competition, rows] of groupBy(
    observations,
    (row) => row.competition,
  )) {
    const seasons = [
      ...new Map(
        rows.map((row) => [row.seasonName, row.seasonStart.getTime()]),
      ),
    ]
      .sort((a, b) => a[1] - b[1])
      .map(([name]) => name);
    if (seasons.length < 3) continue;
    const validationSeason = seasons.at(-2);
    const holdoutSeason = seasons.at(-1);
    if (!validationSeason || !holdoutSeason) continue;
    const trainSeasons = seasons.slice(0, -2);
    const trainSet = new Set(trainSeasons);
    result.set(competition, {
      train: rows.filter((row) => trainSet.has(row.seasonName)),
      validation: rows.filter((row) => row.seasonName === validationSeason),
      holdout: rows.filter((row) => row.seasonName === holdoutSeason),
      trainSeasons,
      validationSeason,
      holdoutSeason,
    });
  }
  return result;
}

function selectStrata(splits: ReadonlyMap<string, SeasonSplit>): Stratum[] {
  const allTrain = [...splits.values()].flatMap((split) => split.train);
  const globalFits = fitByMarket(allTrain);
  const selected: Stratum[] = [];

  for (const [competition, split] of splits) {
    const trainGroups = groupBy(split.train, marketKey);
    const validationGroups = groupBy(split.validation, marketKey);
    for (const [key, validation] of validationGroups) {
      const train = trainGroups.get(key) ?? [];
      if (
        train.length < MIN_TRAIN_OBSERVATIONS ||
        validation.length < MIN_VALIDATION_OBSERVATIONS
      ) {
        continue;
      }
      const pooled = globalFits.get(key);
      if (!pooled) continue;
      const reliability = shrinkTowardPooled(
        fitReliability(
          train.map((row) => ({
            probability: row.fairProbability,
            won: row.won,
          })),
        ),
        pooled,
        LEAGUE_PRIOR_WEIGHT,
      );
      const marketBrier = brier(validation, (row) => row.fairProbability);
      const calibratedBrier = brier(validation, (row) =>
        applyReliability(row.fairProbability, reliability),
      );
      const brierImprovement = marketBrier - calibratedBrier;
      if (brierImprovement < MIN_BRIER_IMPROVEMENT) continue;
      const [market, pick] = key.split(":");
      if (!market || !pick) continue;
      selected.push({
        key: `${competition}:${key}`,
        competition,
        market,
        pick,
        trainN: train.length,
        validationN: validation.length,
        marketBrier,
        calibratedBrier,
        brierImprovement,
        reliability,
      });
    }
  }
  return selected.sort((a, b) => a.key.localeCompare(b.key));
}

function refitSelectedStrata(
  splits: ReadonlyMap<string, SeasonSplit>,
  selected: readonly Stratum[],
): Map<string, ChannelReliability> {
  const allDevelopment = [...splits.values()].flatMap((split) => [
    ...split.train,
    ...split.validation,
  ]);
  const globalFits = fitByMarket(allDevelopment);
  const selectedKeys = new Set(selected.map((stratum) => stratum.key));
  const result = new Map<string, ChannelReliability>();
  for (const [competition, split] of splits) {
    const development = [...split.train, ...split.validation];
    for (const [key, rows] of groupBy(development, marketKey)) {
      const fullKey = `${competition}:${key}`;
      if (!selectedKeys.has(fullKey)) continue;
      const pooled = globalFits.get(key);
      if (!pooled) continue;
      result.set(
        fullKey,
        shrinkTowardPooled(
          fitReliability(
            rows.map((row) => ({
              probability: row.fairProbability,
              won: row.won,
            })),
          ),
          pooled,
          LEAGUE_PRIOR_WEIGHT,
        ),
      );
    }
  }
  return result;
}

type LeagueCouponLeg = CouponLeg & {
  observation: Observation;
  fairProbability: number;
  edge: number;
};

function toLeg(
  observation: Observation,
  reliability: ChannelReliability,
): LeagueCouponLeg {
  const probability = applyReliability(
    observation.fairProbability,
    reliability,
  );
  return {
    fixtureId: observation.fixtureId,
    canal: `LEAGUE_${observation.market}_${observation.pick}`,
    market: observation.market,
    pick: observation.pick,
    competition: observation.competition,
    dayBucket: observation.scheduledAt.toISOString().slice(0, 10),
    probability,
    calibratedHitRate: probability,
    calibratedProbability: probability,
    oddsSnapshot: observation.odds,
    referenceOdds: observation.odds,
    featureSnapshot: {
      policyVersion: POLICY_VERSION,
      season: observation.seasonName,
      fairProbability: observation.fairProbability,
    },
    offensiveBalance: null,
    shadowConflict: null,
    priorAnalysisCount: 0,
    observation,
    fairProbability: observation.fairProbability,
    edge: probability - 1 / observation.odds,
  };
}

function evaluate(
  observations: readonly Observation[],
  reliabilityByStratum: ReadonlyMap<string, ChannelReliability>,
  config: ComposerConfig,
): EvaluatedCoupon[] {
  const candidates = observations
    .map((observation) => {
      const reliability = reliabilityByStratum.get(stratumKey(observation));
      return reliability ? toLeg(observation, reliability) : null;
    })
    .filter((leg): leg is LeagueCouponLeg => leg !== null)
    .filter(
      (leg) =>
        leg.oddsSnapshot !== null &&
        leg.oddsSnapshot >= MIN_LEG_ODDS &&
        leg.oddsSnapshot <= MAX_LEG_ODDS &&
        leg.edge >= config.minEdge &&
        leg.edge <= MAX_POSITIVE_EDGE,
    );
  const couponClass: CouponClass = {
    name: "LEAGUE_MARKET",
    minLegOdds: MIN_LEG_ODDS,
    maxLegOdds: MAX_LEG_ODDS + Number.EPSILON,
    maxLegs: config.maxLegs,
    targetCombinedOdds: 5,
    targetOddsMin: 5,
    targetOddsMax: config.maxCombinedOdds,
  };
  const bounds: CouponBounds = {
    minLegs: 2,
    maxLegs: config.maxLegs,
    minCombinedOdds: 5,
    maxCombinedOdds: config.maxCombinedOdds,
  };

  return [...groupBy(candidates, (leg) => leg.dayBucket)].map(
    ([day, dayCandidates]) => {
      const composed = composeDeterministicCoupon(
        dayCandidates,
        couponClass,
        bounds,
        { maxPositiveEdge: MAX_POSITIVE_EDGE },
      );
      if (composed.outcome !== "composed") {
        return {
          day,
          outcome: "ABSTAINED" as const,
          profit: 0,
          combinedOdds: null,
          legs: [],
        };
      }
      const won = composed.coupon.legs.every((leg) => leg.observation.won);
      return {
        day,
        outcome: won ? ("WON" as const) : ("LOST" as const),
        profit: won ? composed.coupon.combinedOdds - 1 : -1,
        combinedOdds: composed.coupon.combinedOdds,
        legs: composed.coupon.legs.map((leg) => ({
          fixtureId: leg.fixtureId,
          competition: leg.competition,
          market: leg.market,
          pick: leg.pick,
          probability: leg.calibratedProbability ?? leg.probability,
          fairProbability: leg.fairProbability,
          edge: leg.edge,
          odds: leg.oddsSnapshot as number,
          won: leg.observation.won,
        })),
      };
    },
  );
}

function summarize(rows: readonly EvaluatedCoupon[]) {
  const settled = rows.filter((row) => row.outcome !== "ABSTAINED");
  const profits = settled.map((row) => row.profit);
  const roi = profits.length
    ? profits.reduce((sum, value) => sum + value, 0) / profits.length
    : null;
  const mean = roi ?? 0;
  const variance =
    profits.length > 1
      ? profits.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
        (profits.length - 1)
      : 0;
  const standardError = profits.length
    ? Math.sqrt(variance / profits.length)
    : null;
  const months = groupBy(settled, (row) => row.day.slice(0, 7));
  const positiveMonths = [...months.values()].filter(
    (month) => month.reduce((sum, row) => sum + row.profit, 0) > 0,
  ).length;
  return {
    coupons: settled.length,
    won: settled.filter((row) => row.outcome === "WON").length,
    lost: settled.filter((row) => row.outcome === "LOST").length,
    abstained: rows.length - settled.length,
    roi,
    ci95:
      roi === null || standardError === null
        ? null
        : [roi - 1.96 * standardError, roi + 1.96 * standardError],
    lower95:
      roi === null || standardError === null
        ? null
        : roi - 1.96 * standardError,
    months: months.size,
    positiveMonths,
  };
}

function chooseConfig(
  rows: Array<{
    config: ComposerConfig;
    summary: ReturnType<typeof summarize>;
  }>,
): ComposerConfig | null {
  return (
    rows
      .filter((row) => row.summary.coupons >= MIN_CONFIG_COUPONS)
      .sort(
        (a, b) =>
          (b.summary.lower95 ?? -Infinity) - (a.summary.lower95 ?? -Infinity) ||
          b.summary.positiveMonths - a.summary.positiveMonths ||
          a.config.maxLegs - b.config.maxLegs ||
          a.config.maxCombinedOdds - b.config.maxCombinedOdds ||
          b.config.minEdge - a.config.minEdge,
      )[0]?.config ?? null
  );
}

async function loadObservations(): Promise<Observation[]> {
  const rows = await prisma.$queryRaw<RawObservation[]>(Prisma.sql`
    WITH latest_1x2 AS (
      SELECT DISTINCT ON (o."fixtureId")
        o."fixtureId", o."homeOdds", o."drawOdds", o."awayOdds"
      FROM odds_snapshot o
      JOIN fixture f ON f.id = o."fixtureId"
      WHERE o.source = 'HISTORICAL'
        AND o.market = 'ONE_X_TWO'
        AND o."snapshotAt" < f."scheduledAt"
        AND o."homeOdds" IS NOT NULL
        AND o."drawOdds" IS NOT NULL
        AND o."awayOdds" IS NOT NULL
      ORDER BY o."fixtureId", o."snapshotAt" DESC, o.id DESC
    ),
    latest_other AS (
      SELECT DISTINCT ON (o."fixtureId", o.market, o.pick)
        o."fixtureId", o.market::text AS market, o.pick, o.odds
      FROM odds_snapshot o
      JOIN fixture f ON f.id = o."fixtureId"
      WHERE o.source = 'HISTORICAL'
        AND o.market IN ('OVER_UNDER', 'BTTS', 'FIRST_HALF_WINNER')
        AND o."snapshotAt" < f."scheduledAt"
        AND o.pick IS NOT NULL
        AND o.odds IS NOT NULL
      ORDER BY o."fixtureId", o.market, o.pick, o."snapshotAt" DESC, o.id DESC
    ),
    raw_picks AS (
      SELECT
        o."fixtureId",
        'ONE_X_TWO'::text AS market,
        pick.pick,
        pick.odds
      FROM latest_1x2 o
      CROSS JOIN LATERAL (
        VALUES
          ('HOME'::text, o."homeOdds"),
          ('DRAW'::text, o."drawOdds"),
          ('AWAY'::text, o."awayOdds")
      ) AS pick(pick, odds)
      UNION ALL
      SELECT "fixtureId", market, pick, odds FROM latest_other
    ),
    normalized AS (
      SELECT
        p.*,
        (1 / p.odds::double precision) /
          sum(1 / p.odds::double precision) OVER (
            PARTITION BY p."fixtureId", p.market
          ) AS "fairProbability",
        count(*) OVER (
          PARTITION BY p."fixtureId", p.market
        ) AS pick_count
      FROM raw_picks p
      WHERE p.odds > 1
    )
    SELECT
      f.id AS "fixtureId",
      f."scheduledAt",
      s.name AS "seasonName",
      s."startDate" AS "seasonStart",
      c.code AS competition,
      n.market,
      n.pick,
      n.odds,
      n."fairProbability",
      CASE
        WHEN n.market = 'ONE_X_TWO' AND n.pick = 'HOME'
          THEN f."homeScore" > f."awayScore"
        WHEN n.market = 'ONE_X_TWO' AND n.pick = 'DRAW'
          THEN f."homeScore" = f."awayScore"
        WHEN n.market = 'ONE_X_TWO' AND n.pick = 'AWAY'
          THEN f."homeScore" < f."awayScore"
        WHEN n.market = 'OVER_UNDER' AND n.pick = 'OVER'
          THEN f."homeScore" + f."awayScore" >= 3
        WHEN n.market = 'OVER_UNDER' AND n.pick = 'UNDER'
          THEN f."homeScore" + f."awayScore" <= 2
        WHEN n.market = 'BTTS' AND n.pick = 'YES'
          THEN f."homeScore" > 0 AND f."awayScore" > 0
        WHEN n.market = 'BTTS' AND n.pick = 'NO'
          THEN f."homeScore" = 0 OR f."awayScore" = 0
        WHEN n.market = 'FIRST_HALF_WINNER' AND n.pick = 'HOME'
          THEN f."homeHtScore" > f."awayHtScore"
        WHEN n.market = 'FIRST_HALF_WINNER' AND n.pick = 'DRAW'
          THEN f."homeHtScore" = f."awayHtScore"
        WHEN n.market = 'FIRST_HALF_WINNER' AND n.pick = 'AWAY'
          THEN f."homeHtScore" < f."awayHtScore"
        ELSE false
      END AS won
    FROM normalized n
    JOIN fixture f ON f.id = n."fixtureId"
    JOIN season s ON s.id = f."seasonId"
    JOIN competition c ON c.id = s."competitionId"
    WHERE f.status = 'FINISHED'
      AND f."homeScore" IS NOT NULL
      AND f."awayScore" IS NOT NULL
      AND (
        (n.market IN ('ONE_X_TWO', 'FIRST_HALF_WINNER') AND n.pick_count = 3)
        OR (n.market IN ('OVER_UNDER', 'BTTS') AND n.pick_count = 2)
      )
      AND (
        n.market <> 'FIRST_HALF_WINNER'
        OR (f."homeHtScore" IS NOT NULL AND f."awayHtScore" IS NOT NULL)
      )
    ORDER BY f."scheduledAt", f.id, n.market, n.pick
  `);
  return rows.map((row) => ({ ...row, odds: Number(row.odds) }));
}

function pct(value: number | null): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;
}

async function main(): Promise<void> {
  const phase = process.argv.includes("--holdout") ? "holdout" : "development";
  const observations = await loadObservations();
  const splits = splitByCompetition(observations);
  const selectedStrata = selectStrata(splits);

  console.log(
    `${observations.length} issues cotées, ${splits.size} championnats avec au moins trois saisons, ${selectedStrata.length} strates validées.`,
  );

  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });

  if (phase === "development") {
    const validationFits = new Map(
      selectedStrata.map((stratum) => [stratum.key, stratum.reliability]),
    );
    const validation = [...splits.values()].flatMap(
      (split) => split.validation,
    );
    const configurations = CONFIGS.map((config) => {
      const daily = evaluate(validation, validationFits, config);
      return { config, summary: summarize(daily) };
    });
    const selectedConfig = chooseConfig(configurations);
    for (const row of configurations) {
      console.log(
        `${row.config.name.padEnd(23)} n=${String(row.summary.coupons).padStart(4)} roi=${pct(row.summary.roi).padStart(7)} low95=${pct(row.summary.lower95).padStart(7)} months=${row.summary.positiveMonths}/${row.summary.months}`,
      );
    }
    console.log(`Candidat développement : ${selectedConfig?.name ?? "aucun"}`);
    const report = {
      policyVersion: POLICY_VERSION,
      phase,
      methodology: {
        train: "all seasons before the two most recent per competition",
        validation: "penultimate season per competition",
        untouchedHoldout: "most recent season per competition",
        historicalOddsTiming: "latest HISTORICAL snapshot before kickoff",
        calibration: "league-market-pick Platt shrunk to global market-pick",
        selection:
          "validation Brier improvement >= 0.001; composer maximizes lower 95% ROI bound",
      },
      counts: {
        observations: observations.length,
        competitions: splits.size,
        selectedStrata: selectedStrata.length,
      },
      seasons: [...splits].map(([competition, split]) => ({
        competition,
        train: split.trainSeasons,
        validation: split.validationSeason,
        holdout: split.holdoutSeason,
      })),
      strata: selectedStrata,
      configurations,
      selectedConfig,
    };
    writeFileSync(
      join(reportsDir, `${POLICY_VERSION}-development.json`),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    return;
  }

  if (FROZEN_CONFIG_NAME === null) {
    throw new Error(
      "Holdout locked: set FROZEN_CONFIG_NAME only after committing the development report",
    );
  }
  const config = CONFIGS.find((value) => value.name === FROZEN_CONFIG_NAME);
  if (!config) throw new Error(`Unknown frozen config ${FROZEN_CONFIG_NAME}`);
  const refitted = refitSelectedStrata(splits, selectedStrata);
  const holdout = [...splits.values()].flatMap((split) => split.holdout);
  const daily = evaluate(holdout, refitted, config);
  const report = {
    policyVersion: POLICY_VERSION,
    phase,
    config,
    summary: summarize(daily),
    daily,
  };
  writeFileSync(
    join(reportsDir, `${POLICY_VERSION}-holdout.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(report.summary);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
