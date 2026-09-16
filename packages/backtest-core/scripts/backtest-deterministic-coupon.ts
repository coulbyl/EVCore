import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DETERMINISTIC_COUPON_POLICY_VERSION,
  DETERMINISTIC_COUPON_BOUNDS,
  DETERMINISTIC_COUPON_CLASS,
  DETERMINISTIC_MAX_POSITIVE_EDGE,
  UNIFIED_COUPON_BOUNDS,
  UNIFIED_COUPON_CLASS,
  calibrateLegProbability,
  composeDeterministicCoupon,
  fitReliability,
  shrinkTowardPooled,
  type ChannelReliabilityMap,
  type CouponLeg,
  type ReliabilityObservation,
} from "@evcore/analysis-core";
import { prisma } from "@evcore/db";
import {
  PointInTimeLoader,
  type CouponCalibrationObservation,
  type CouponReplaySelection,
} from "../src/point-in-time-loader";

type ReplayRow = {
  candidate: CouponLeg;
  result: CouponReplaySelection["result"];
};

type ComposerConfig = {
  name: string;
  maxLegs: number;
  maxCombinedOdds: number;
  maxLegOdds: number;
  minProbability: number;
  maxPositiveEdge: number;
};

const BASELINE_CONFIG: ComposerConfig = {
  name: "baseline",
  maxLegs: 5,
  maxCombinedOdds: 15,
  maxLegOdds: 15.01,
  minProbability: 0,
  maxPositiveEdge: 0.1,
};

const BASELINE_POLICY_VERSION = "deterministic-5-15-v1";

const CANDIDATE_CONFIG: ComposerConfig = {
  name: "candidate-max3-odds7-edge075",
  maxLegs: DETERMINISTIC_COUPON_BOUNDS.maxLegs,
  maxCombinedOdds: DETERMINISTIC_COUPON_BOUNDS.maxCombinedOdds,
  maxLegOdds: DETERMINISTIC_COUPON_CLASS.maxLegOdds,
  minProbability: 0,
  maxPositiveEdge: DETERMINISTIC_MAX_POSITIVE_EDGE,
};

const RESEARCH_CONFIGS: readonly ComposerConfig[] = [
  BASELINE_CONFIG,
  { ...BASELINE_CONFIG, name: "max-3-legs", maxLegs: 3 },
  { ...BASELINE_CONFIG, name: "max-2-legs", maxLegs: 2 },
  { ...BASELINE_CONFIG, name: "odds-max-7", maxCombinedOdds: 7 },
  { ...BASELINE_CONFIG, name: "odds-max-6", maxCombinedOdds: 6 },
  { ...BASELINE_CONFIG, name: "leg-odds-max-3", maxLegOdds: 3 },
  { ...BASELINE_CONFIG, name: "leg-odds-max-2.5", maxLegOdds: 2.5 },
  { ...BASELINE_CONFIG, name: "prob-min-40", minProbability: 0.4 },
  { ...BASELINE_CONFIG, name: "prob-min-50", minProbability: 0.5 },
  { ...BASELINE_CONFIG, name: "edge-max-075", maxPositiveEdge: 0.075 },
  { ...BASELINE_CONFIG, name: "edge-max-050", maxPositiveEdge: 0.05 },
  {
    ...BASELINE_CONFIG,
    name: "max3-odds7-edge075",
    maxLegs: 3,
    maxCombinedOdds: 7,
    maxPositiveEdge: 0.075,
  },
  {
    ...BASELINE_CONFIG,
    name: "max3-odds7-edge050",
    maxLegs: 3,
    maxCombinedOdds: 7,
    maxPositiveEdge: 0.05,
  },
  {
    ...BASELINE_CONFIG,
    name: "max3-odds7-prob40",
    maxLegs: 3,
    maxCombinedOdds: 7,
    minProbability: 0.4,
  },
  {
    ...BASELINE_CONFIG,
    name: "max3-odds6.5-edge075",
    maxLegs: 3,
    maxCombinedOdds: 6.5,
    maxPositiveEdge: 0.075,
  },
  {
    ...BASELINE_CONFIG,
    name: "max3-odds7.5-edge075",
    maxLegs: 3,
    maxCombinedOdds: 7.5,
    maxPositiveEdge: 0.075,
  },
  {
    ...BASELINE_CONFIG,
    name: "max2-odds7-edge075",
    maxLegs: 2,
    maxCombinedOdds: 7,
    maxPositiveEdge: 0.075,
  },
  {
    ...BASELINE_CONFIG,
    name: "max3-odds7-edge065",
    maxLegs: 3,
    maxCombinedOdds: 7,
    maxPositiveEdge: 0.065,
  },
  {
    ...BASELINE_CONFIG,
    name: "max3-odds7-edge085",
    maxLegs: 3,
    maxCombinedOdds: 7,
    maxPositiveEdge: 0.085,
  },
  {
    ...BASELINE_CONFIG,
    name: "max3-odds7-edge090",
    maxLegs: 3,
    maxCombinedOdds: 7,
    maxPositiveEdge: 0.09,
  },
];

type DailyResult = {
  day: string;
  outcome: "WON" | "LOST" | "VOID" | "ABSTAINED" | "UNRESOLVED";
  candidateCount: number;
  legCount: number;
  combinedOdds: number | null;
  profit: number | null;
  legs: Array<{
    fixtureId: string;
    channel: string;
    market: string;
    pick: string;
    probability: number;
    odds: number;
    result: CouponReplaySelection["result"];
  }>;
};

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseDay(value: string, label: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()))
    throw new Error(`Invalid ${label}: ${value}`);
  return date;
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function generationWindowEnd(day: Date): Date {
  const dayOfWeek = day.getUTCDay();
  const extraDays = dayOfWeek === 5 || dayOfWeek === 2 ? 2 : 0;
  return new Date(addDays(day, extraDays + 1).getTime() - 1);
}

function calibrationFor(observations: CouponCalibrationObservation[]) {
  const all: ReliabilityObservation[] = observations.map((observation) => ({
    probability: observation.probability,
    won: observation.won,
  }));
  const pooled = fitReliability(all);
  const grouped = new Map<string, ReliabilityObservation[]>();
  for (const observation of observations) {
    const bucket = grouped.get(observation.channel) ?? [];
    bucket.push({ probability: observation.probability, won: observation.won });
    grouped.set(observation.channel, bucket);
  }
  const channelReliability: ChannelReliabilityMap = {};
  for (const [channel, values] of grouped) {
    channelReliability[channel] = shrinkTowardPooled(
      fitReliability(values),
      pooled,
    );
  }
  return { channelReliability, pooledReliability: pooled };
}

function toCandidate(
  selection: CouponReplaySelection,
  calibration: ReturnType<typeof calibrationFor>,
): ReplayRow {
  const calibratedProbability = calibrateLegProbability(
    { probability: selection.probability, canal: selection.channel },
    {
      channelReliability: calibration.channelReliability,
      pooledReliability: calibration.pooledReliability,
    },
  );
  return {
    candidate: {
      fixtureId: selection.fixtureId,
      canal: selection.channel,
      market: selection.market,
      pick: selection.pick,
      competition: selection.competition,
      dayBucket: formatDay(selection.scheduledAt),
      probability: selection.probability,
      calibratedHitRate: calibratedProbability,
      calibratedProbability,
      oddsSnapshot: selection.odds,
      referenceOdds: selection.odds,
      featureSnapshot: {
        ...selection.featureSnapshot,
        competitionCode: selection.competitionCode,
      },
      offensiveBalance: null,
      shadowConflict: null,
      priorAnalysisCount: 0,
    },
    result: selection.result,
  };
}

function candidateKey(candidate: CouponLeg): string {
  return [
    candidate.fixtureId,
    candidate.canal,
    candidate.market,
    candidate.pick,
  ].join(":");
}

function settle(
  day: string,
  rows: ReplayRow[],
  config: ComposerConfig = BASELINE_CONFIG,
): DailyResult {
  const filteredRows = rows.filter((row) => {
    const probability =
      row.candidate.calibratedProbability ?? row.candidate.probability;
    return probability >= config.minProbability;
  });
  const candidates = filteredRows.map((row) => row.candidate);
  const results = new Map(
    filteredRows.map((row) => [candidateKey(row.candidate), row.result]),
  );
  const composed = composeDeterministicCoupon(
    candidates,
    {
      ...UNIFIED_COUPON_CLASS,
      maxLegs: config.maxLegs,
      maxLegOdds: config.maxLegOdds,
    },
    {
      ...UNIFIED_COUPON_BOUNDS,
      maxLegs: config.maxLegs,
      maxCombinedOdds: config.maxCombinedOdds,
    },
    { maxPositiveEdge: config.maxPositiveEdge },
  );
  if (composed.outcome !== "composed") {
    return {
      day,
      outcome: "ABSTAINED",
      candidateCount: candidates.length,
      legCount: 0,
      combinedOdds: null,
      profit: 0,
      legs: [],
    };
  }

  const legs = composed.coupon.legs;
  const resultFor = (leg: CouponLeg) => results.get(candidateKey(leg)) ?? null;
  const legReports = legs.map((leg) => ({
    fixtureId: leg.fixtureId,
    channel: leg.canal,
    market: leg.market,
    pick: leg.pick,
    probability: leg.calibratedProbability ?? leg.probability,
    odds: leg.oddsSnapshot as number,
    result: resultFor(leg),
  }));
  if (
    legs.some((leg) => resultFor(leg) === null || resultFor(leg) === "PENDING")
  ) {
    return {
      day,
      outcome: "UNRESOLVED",
      candidateCount: candidates.length,
      legCount: legs.length,
      combinedOdds: composed.coupon.combinedOdds,
      profit: null,
      legs: legReports,
    };
  }
  if (legs.some((leg) => resultFor(leg) === "LOST")) {
    return {
      day,
      outcome: "LOST",
      candidateCount: candidates.length,
      legCount: legs.length,
      combinedOdds: composed.coupon.combinedOdds,
      profit: -1,
      legs: legReports,
    };
  }
  const surviving = legs.filter((leg) => resultFor(leg) === "WON");
  if (surviving.length === 0) {
    return {
      day,
      outcome: "VOID",
      candidateCount: candidates.length,
      legCount: legs.length,
      combinedOdds: composed.coupon.combinedOdds,
      profit: 0,
      legs: legReports,
    };
  }
  const realizedOdds = surviving.reduce(
    (product, leg) => product * (leg.oddsSnapshot as number),
    1,
  );
  return {
    day,
    outcome: "WON",
    candidateCount: candidates.length,
    legCount: legs.length,
    combinedOdds: composed.coupon.combinedOdds,
    profit: realizedOdds - 1,
    legs: legReports,
  };
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function stats(rows: DailyResult[]) {
  const settled = rows.filter(
    (row) =>
      row.outcome === "WON" || row.outcome === "LOST" || row.outcome === "VOID",
  );
  const profits = settled.flatMap((row) =>
    row.profit === null ? [] : [row.profit],
  );
  const roi =
    profits.length === 0
      ? null
      : profits.reduce((sum, profit) => sum + profit, 0) / profits.length;
  const mean = roi ?? 0;
  const variance =
    profits.length < 2
      ? null
      : profits.reduce((sum, profit) => sum + (profit - mean) ** 2, 0) /
        (profits.length - 1);
  const margin =
    variance === null ? null : 1.96 * Math.sqrt(variance / profits.length);
  return {
    days: rows.length,
    coupons: settled.length,
    won: settled.filter((row) => row.outcome === "WON").length,
    lost: settled.filter((row) => row.outcome === "LOST").length,
    void: settled.filter((row) => row.outcome === "VOID").length,
    abstained: rows.filter((row) => row.outcome === "ABSTAINED").length,
    unresolved: rows.filter((row) => row.outcome === "UNRESOLVED").length,
    hitRate:
      settled.length === 0
        ? null
        : settled.filter((row) => row.outcome === "WON").length /
          settled.length,
    averageOdds:
      settled.length === 0
        ? null
        : settled.reduce((sum, row) => sum + (row.combinedOdds ?? 0), 0) /
          settled.length,
    averageLegs:
      settled.length === 0
        ? null
        : settled.reduce((sum, row) => sum + row.legCount, 0) / settled.length,
    roi,
    roiCi95:
      margin === null || roi === null ? null : [roi - margin, roi + margin],
  };
}

function pct(value: number | null): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;
}

function intervalText(interval: number[] | null): string {
  return interval
    ? `[${pct(interval[0] ?? null)}, ${pct(interval[1] ?? null)}]`
    : "n/a";
}

async function main(): Promise<void> {
  const from = parseDay(option("--from") ?? "2026-07-01", "--from");
  const to = parseDay(option("--to") ?? "2026-09-13", "--to");
  if (from > to) throw new Error("--from must be before --to");

  const loader = new PointInTimeLoader();
  const replayDays: Array<{ day: string; rows: ReplayRow[] }> = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const asOf = new Date(day);
    const [selections, observations] = await Promise.all([
      loader.loadCouponSelections({
        from: day,
        to: generationWindowEnd(day),
        asOf,
      }),
      loader.loadCouponCalibrationObservations(asOf),
    ]);
    const calibration = calibrationFor(observations);
    replayDays.push({
      day: formatDay(day),
      rows: selections.map((selection) => toCandidate(selection, calibration)),
    });
  }

  if (hasFlag("--sweep")) {
    const sweep = RESEARCH_CONFIGS.map((config) => {
      const rows = replayDays.map((entry) =>
        settle(entry.day, entry.rows, config),
      );
      const foldSize = Math.ceil(rows.length / 3);
      return {
        config,
        overall: stats(rows),
        folds: [0, 1, 2].map((index) =>
          stats(rows.slice(index * foldSize, (index + 1) * foldSize)),
        ),
      };
    });
    const reportsDir = join(process.cwd(), "reports");
    mkdirSync(reportsDir, { recursive: true });
    const stem = `deterministic-coupon-sweep-${formatDay(from)}-${formatDay(to)}`;
    writeFileSync(
      join(reportsDir, `${stem}.json`),
      `${JSON.stringify({ period: { from: formatDay(from), to: formatDay(to) }, sweep }, null, 2)}\n`,
    );
    for (const row of sweep) {
      console.log(
        [
          row.config.name.padEnd(24),
          `n=${String(row.overall.coupons).padStart(2)}`,
          `roi=${pct(row.overall.roi).padStart(7)}`,
          `folds=${row.folds.map((fold) => pct(fold.roi)).join(",")}`,
          `abst=${row.overall.abstained}`,
        ].join("  "),
      );
    }
    return;
  }

  const selectedConfig =
    option("--config") === "candidate" ? CANDIDATE_CONFIG : BASELINE_CONFIG;
  const rows = replayDays.map((entry) =>
    settle(entry.day, entry.rows, selectedConfig),
  );
  const policyVersion =
    selectedConfig === CANDIDATE_CONFIG
      ? DETERMINISTIC_COUPON_POLICY_VERSION
      : BASELINE_POLICY_VERSION;

  const splitIndex = Math.floor(rows.length * 0.6);
  const report = {
    policyVersion,
    livePolicyUnchanged: "unified-5-15-v1",
    generatedAt: new Date().toISOString(),
    period: { from: formatDay(from), to: formatDay(to) },
    composerConfig: selectedConfig,
    objective: "max_joint_probability_then_coupon_ev_then_fewer_legs",
    limitations: [
      "Historical stored channel decisions are replayed; the current engine is not recomputed.",
      "Stored selection odds are used because legacy selections have no immutable odds-snapshot link.",
      "Evaluated-market candidates are excluded; only stored rank-one selections are eligible.",
      "VANTAGE candidates are excluded, so neither composition nor candidate production uses AI.",
      "Historical AVOID signals and past schedule revisions cannot be reconstructed.",
    ],
    overall: stats(rows),
    train: stats(rows.slice(0, splitIndex)),
    validation: stats(rows.slice(splitIndex)),
    daily: rows,
  };

  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const stem = `deterministic-coupon-${selectedConfig.name}-${formatDay(from)}-${formatDay(to)}`;
  writeFileSync(
    join(reportsDir, `${stem}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  const markdown = [
    `# Backtest ${policyVersion}`,
    "",
    `Période : ${report.period.from} → ${report.period.to}. Politique LLM active inchangée.`,
    "",
    "| Segment | Jours | Coupons | Gagnés | Perdus | Abst. | Non résolus | Réussite | ROI | IC95 |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    `| Global | ${report.overall.days} | ${report.overall.coupons} | ${report.overall.won} | ${report.overall.lost} | ${report.overall.abstained} | ${report.overall.unresolved} | ${pct(report.overall.hitRate)} | ${pct(report.overall.roi)} | ${intervalText(report.overall.roiCi95)} |`,
    `| Train 60 % | ${report.train.days} | ${report.train.coupons} | ${report.train.won} | ${report.train.lost} | ${report.train.abstained} | ${report.train.unresolved} | ${pct(report.train.hitRate)} | ${pct(report.train.roi)} | ${intervalText(report.train.roiCi95)} |`,
    `| Validation 40 % | ${report.validation.days} | ${report.validation.coupons} | ${report.validation.won} | ${report.validation.lost} | ${report.validation.abstained} | ${report.validation.unresolved} | ${pct(report.validation.hitRate)} | ${pct(report.validation.roi)} | ${intervalText(report.validation.roiCi95)} |`,
    "",
    `Coupon moyen : ${report.overall.averageLegs?.toFixed(2) ?? "n/a"} jambes, cote ${report.overall.averageOdds?.toFixed(2) ?? "n/a"}.`,
    "",
    "## Limites",
    "",
    ...report.limitations.map((limitation) => `- ${limitation}`),
    "",
  ].join("\n");
  writeFileSync(join(reportsDir, `${stem}.md`), markdown);
  console.log(markdown);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
