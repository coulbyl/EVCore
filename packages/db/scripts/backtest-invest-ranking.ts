/// <reference types="node" />
/**
 * Backtest jour par jour des formules de classement topN pour les modes
 * "value" et "draw" de la page Investir.
 * Run: pnpm --filter @evcore/db db:backtest:invest-ranking
 * Output: packages/db/reports/backtest-invest-ranking-YYYY-MM-DD.txt
 *
 * Contexte : investment.service.ts classe "value" par EV brute et "draw" par
 * probabilite calibree. Constat terrain : les hautes probas meurent et les
 * basses rentrent — la proba (meme calibree) ne suffit pas comme axe de
 * classement. Ce script mesure, jour par jour et en topN (N=3/5), le ROI et
 * le hit-rate de plusieurs formules candidates par canal, avec la MEME
 * calibration leak-free que le service (fenetre 180j, min 30 samples,
 * mesuree uniquement sur les resultats connus avant le debut du jour teste).
 *
 * Un split temporel 60/40 verifie que la formule gagnante tient en forward,
 * pas seulement sur la periode qui l'a designee.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/client";

const CALIBRATION_WINDOW_DAYS = 180;
const CALIBRATION_MIN_SAMPLES = 30;
const TOP_NS = [3, 5] as const;
const EV_THRESHOLD = 0.08;
const TRAIN_SPLIT = 0.6;
const DAY_MS = 24 * 60 * 60 * 1000;

type Row = {
  scheduledAt: Date;
  channel: string;
  market: string;
  pick: string;
  probability: number;
  odds: number;
  ev: number | null;
  qualityScore: number | null;
  lambdaHome: number | null;
  lambdaAway: number | null;
  result: "WON" | "LOST";
};

type ScoredPick = Row & { probCal: number };

type Formula = {
  name: string;
  score: (p: ScoredPick) => number | null;
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function lambdaDiff(p: ScoredPick): number | null {
  if (p.lambdaHome === null || p.lambdaAway === null) return null;
  return Math.abs(p.lambdaHome - p.lambdaAway);
}

function lambdaTotal(p: ScoredPick): number | null {
  if (p.lambdaHome === null || p.lambdaAway === null) return null;
  return p.lambdaHome + p.lambdaAway;
}

const VALUE_FORMULAS: Formula[] = [
  { name: "probCal (tri du mode proba)", score: (p) => p.probCal },
  { name: "evRaw (tri actuel du mode value)", score: (p) => p.ev },
  { name: "evCal = probCal*cote - 1", score: (p) => p.probCal * p.odds - 1 },
  { name: "edgeCal = probCal - 1/cote", score: (p) => p.probCal - 1 / p.odds },
];

// Canaux mono-mode (safe/dominant/btts/goals) : tri actuel = probCal, plus
// les memes candidats que VALUE et le qualityScore stocke par le moteur.
const SINGLE_CHANNEL_FORMULAS: Formula[] = [
  { name: "probCal (tri actuel)", score: (p) => p.probCal },
  { name: "evRaw", score: (p) => p.ev },
  { name: "evCal = probCal*cote - 1", score: (p) => p.probCal * p.odds - 1 },
  { name: "edgeCal = probCal - 1/cote", score: (p) => p.probCal - 1 / p.odds },
  { name: "qualityScore", score: (p) => p.qualityScore },
];

// Replique l'exclusion production des picks GOALS Over/Under qui contredisent
// le lambda du modele (voir investment.service.ts / isLambdaIncoherent) pour
// backtester sur le meme pool que ce que le service retourne.
const OVER_UNDER_LINES: Record<string, number> = {
  OVER_1_5: 1.5,
  UNDER_1_5: 1.5,
  OVER: 2.5,
  UNDER: 2.5,
  OVER_3_5: 3.5,
  UNDER_3_5: 3.5,
  OVER_4_5: 4.5,
  UNDER_4_5: 4.5,
};

function isLambdaCoherent(p: ScoredPick): boolean {
  if (p.market !== "OVER_UNDER") return true;
  const total = lambdaTotal(p);
  if (total === null) return true;
  const line = OVER_UNDER_LINES[p.pick];
  if (line === undefined) return true;
  if (p.pick.startsWith("UNDER")) return total <= line;
  if (p.pick.startsWith("OVER")) return total >= line;
  return true;
}

const DRAW_FORMULAS: Formula[] = [
  { name: "probCal (tri actuel)", score: (p) => p.probCal },
  { name: "edgeCal = probCal - 1/cote", score: (p) => p.probCal - 1 / p.odds },
  {
    name: "-|lH-lA| (match equilibre d'abord)",
    score: (p) => {
      const d = lambdaDiff(p);
      return d === null ? null : -d;
    },
  },
  {
    name: "-(lH+lA) (match ferme d'abord)",
    score: (p) => {
      const t = lambdaTotal(p);
      return t === null ? null : -t;
    },
  },
];

// Un "pool" = un canal + un eventuel filtre d'entree (ex. la gate EV>=0.08
// deja appliquee par le mode value avant tout classement).
type Pool = {
  label: string;
  channel: string;
  formulas: Formula[];
  filter?: (p: ScoredPick) => boolean;
};

const POOLS: Pool[] = [
  { label: "VALUE — tous les picks", channel: "VALUE", formulas: VALUE_FORMULAS },
  {
    label: `VALUE — gate actuelle EV >= ${EV_THRESHOLD}`,
    channel: "VALUE",
    formulas: VALUE_FORMULAS,
    filter: (p) => p.ev !== null && p.ev >= EV_THRESHOLD,
  },
  { label: "DRAW — tous les picks", channel: "DRAW", formulas: DRAW_FORMULAS },
  { label: "SAFE", channel: "SAFE", formulas: SINGLE_CHANNEL_FORMULAS },
  { label: "DOMINANT", channel: "DOMINANT", formulas: SINGLE_CHANNEL_FORMULAS },
  { label: "BTTS", channel: "BTTS", formulas: SINGLE_CHANNEL_FORMULAS },
  {
    label: "GOALS — hors picks lambda-incoherents (comme en prod)",
    channel: "GOALS",
    formulas: SINGLE_CHANNEL_FORMULAS,
    filter: isLambdaCoherent,
  },
];

type TopNStats = {
  days: number;
  positiveDays: number;
  picks: number;
  wins: number;
  roiSum: number;
};

function emptyTopNStats(): TopNStats {
  return { days: 0, positiveDays: 0, picks: 0, wins: 0, roiSum: 0 };
}

function pickRoi(p: ScoredPick): number {
  return p.result === "WON" ? p.odds - 1 : -1;
}

// stats agregees d'une formule : par N, et par periode (overall/train/valid),
// plus un decoupage par annee pour reperer les inversions de regime.
type FormulaStats = Map<
  number,
  {
    all: TopNStats;
    train: TopNStats;
    valid: TopNStats;
    byYear: Map<string, TopNStats>;
  }
>;

function accumulateTopN(stats: TopNStats, top: ScoredPick[]): void {
  let dayRoi = 0;
  for (const p of top) {
    const roi = pickRoi(p);
    dayRoi += roi;
    stats.roiSum += roi;
    stats.picks += 1;
    if (p.result === "WON") stats.wins += 1;
  }
  stats.days += 1;
  if (dayRoi > 0) stats.positiveDays += 1;
}

// Calibration leak-free en fenetre glissante : pour chaque jour, l'erreur
// moyenne (proba - resultat) des picks settled du canal dans les 180j
// precedant le debut du jour — replique InvestmentCalibrationRepository.
function computeDailyScoredPicks(rows: Row[]): Map<string, ScoredPick[]> {
  const byDay = new Map<string, Row[]>();
  for (const row of rows) {
    const dayKey = row.scheduledAt.toISOString().slice(0, 10);
    const picks = byDay.get(dayKey) ?? [];
    picks.push(row);
    byDay.set(dayKey, picks);
  }

  const scored = new Map<string, ScoredPick[]>();
  const dayKeys = [...byDay.keys()].sort();
  let lo = 0;
  let hi = 0;
  let sumProb = 0;
  let sumWon = 0;

  for (const dayKey of dayKeys) {
    const dayStart = new Date(`${dayKey}T00:00:00.000Z`);
    const since = new Date(dayStart.getTime() - CALIBRATION_WINDOW_DAYS * DAY_MS);

    while (hi < rows.length) {
      const row = rows[hi];
      if (!row || row.scheduledAt >= dayStart) break;
      sumProb += row.probability;
      sumWon += row.result === "WON" ? 1 : 0;
      hi += 1;
    }
    while (lo < hi) {
      const row = rows[lo];
      if (!row || row.scheduledAt >= since) break;
      sumProb -= row.probability;
      sumWon -= row.result === "WON" ? 1 : 0;
      lo += 1;
    }

    const n = hi - lo;
    const meanError = n >= CALIBRATION_MIN_SAMPLES ? (sumProb - sumWon) / n : 0;
    const dayRows = byDay.get(dayKey) ?? [];
    scored.set(
      dayKey,
      dayRows.map((row) => ({
        ...row,
        probCal: clamp01(row.probability - meanError),
      })),
    );
  }

  return scored;
}

function evaluatePool(pool: Pool, scoredByDay: Map<string, ScoredPick[]>): string[] {
  const dayKeys = [...scoredByDay.keys()].sort();
  const splitIndex = Math.floor(dayKeys.length * TRAIN_SPLIT);
  const splitKey = dayKeys[splitIndex] ?? "9999-12-31";

  const perFormula = new Map<string, FormulaStats>();
  for (const formula of pool.formulas) {
    const byN: FormulaStats = new Map();
    for (const n of TOP_NS) {
      byN.set(n, {
        all: emptyTopNStats(),
        train: emptyTopNStats(),
        valid: emptyTopNStats(),
        byYear: new Map(),
      });
    }
    perFormula.set(formula.name, byN);
  }

  for (const dayKey of dayKeys) {
    const allPicks = scoredByDay.get(dayKey) ?? [];
    const picks = pool.filter ? allPicks.filter(pool.filter) : allPicks;
    if (picks.length === 0) continue;

    for (const formula of pool.formulas) {
      const scorable = picks
        .map((p) => ({ pick: p, score: formula.score(p) }))
        .filter((s): s is { pick: ScoredPick; score: number } => s.score !== null)
        .sort((a, b) => b.score - a.score);

      for (const n of TOP_NS) {
        if (scorable.length < n) continue;
        const top = scorable.slice(0, n).map((s) => s.pick);
        const stats = perFormula.get(formula.name)?.get(n);
        if (!stats) continue;
        accumulateTopN(stats.all, top);
        accumulateTopN(dayKey < splitKey ? stats.train : stats.valid, top);
        const year = dayKey.slice(0, 4);
        const yearStats = stats.byYear.get(year) ?? emptyTopNStats();
        stats.byYear.set(year, yearStats);
        accumulateTopN(yearStats, top);
      }
    }
  }

  const lines: string[] = [];
  lines.push(`=== ${pool.label} ===`);
  lines.push(
    `Jours avec picks : ${dayKeys.length} — split train/valid au ${splitKey} (${Math.round(TRAIN_SPLIT * 100)}/${Math.round((1 - TRAIN_SPLIT) * 100)})`,
  );
  for (const formula of pool.formulas) {
    lines.push(`--- ${formula.name} ---`);
    for (const n of TOP_NS) {
      const stats = perFormula.get(formula.name)?.get(n);
      if (!stats) continue;
      lines.push(`  top${n} : ${formatStats(stats.all)}`);
      lines.push(`    train : ${formatStats(stats.train)}`);
      lines.push(`    valid : ${formatStats(stats.valid)}`);
      for (const [year, yearStats] of [...stats.byYear.entries()].sort()) {
        lines.push(`    ${year}  : ${formatStats(yearStats)}`);
      }
    }
  }
  lines.push("");
  return lines;
}

function formatStats(s: TopNStats): string {
  if (s.picks === 0) return "aucun jour eligible";
  const roi = ((s.roiSum / s.picks) * 100).toFixed(2);
  const hit = ((s.wins / s.picks) * 100).toFixed(1);
  const posDays = ((s.positiveDays / Math.max(1, s.days)) * 100).toFixed(1);
  return `${s.days} jours, ${s.picks} picks — ROI ${roi}%, hit ${hit}%, jours positifs ${posDays}%`;
}

// ── Diagnostics par tranche (sur tous les picks settled, pas en topN) ───────

type BucketSpec = {
  title: string;
  extract: (p: ScoredPick) => number | null;
  edges: number[];
};

function bucketDiagnostics(picks: ScoredPick[], spec: BucketSpec): string[] {
  const labels: string[] = [];
  for (let i = 0; i <= spec.edges.length; i++) {
    const loEdge = i === 0 ? null : spec.edges[i - 1];
    const hiEdge = i === spec.edges.length ? null : spec.edges[i];
    if (loEdge === null || loEdge === undefined) labels.push(`< ${hiEdge}`);
    else if (hiEdge === null || hiEdge === undefined) labels.push(`>= ${loEdge}`);
    else labels.push(`[${loEdge}, ${hiEdge})`);
  }

  const stats = labels.map(() => ({ n: 0, wins: 0, roiSum: 0 }));
  for (const p of picks) {
    const value = spec.extract(p);
    if (value === null) continue;
    let idx = spec.edges.findIndex((edge) => value < edge);
    if (idx === -1) idx = spec.edges.length;
    const bucket = stats[idx];
    if (!bucket) continue;
    bucket.n += 1;
    bucket.roiSum += pickRoi(p);
    if (p.result === "WON") bucket.wins += 1;
  }

  const lines = [`--- ${spec.title} ---`];
  labels.forEach((label, i) => {
    const b = stats[i];
    if (!b || b.n === 0) return;
    const roi = ((b.roiSum / b.n) * 100).toFixed(2);
    const hit = ((b.wins / b.n) * 100).toFixed(1);
    lines.push(`  ${label.padEnd(14)} n=${String(b.n).padStart(5)}  hit ${hit}%  ROI ${roi}%`);
  });
  return lines;
}

const VALUE_DIAGNOSTICS: BucketSpec[] = [
  {
    title: "VALUE — par tranche d'evCal (probCal*cote - 1)",
    extract: (p) => p.probCal * p.odds - 1,
    edges: [-0.1, 0, 0.08, 0.2, 0.4],
  },
  {
    title: "VALUE — par tranche d'edgeCal (probCal - 1/cote)",
    extract: (p) => p.probCal - 1 / p.odds,
    edges: [0, 0.05, 0.1, 0.15, 0.2],
  },
  {
    title: "VALUE — par tranche de cote",
    extract: (p) => p.odds,
    edges: [1.5, 2, 2.5, 3, 4],
  },
];

const DRAW_DIAGNOSTICS: BucketSpec[] = [
  {
    title: "DRAW — par tranche de cote du nul",
    extract: (p) => p.odds,
    edges: [3, 3.2, 3.4, 3.6, 4],
  },
  {
    title: "DRAW — par tranche de |lH - lA| (equilibre du match)",
    extract: lambdaDiff,
    edges: [0.2, 0.4, 0.7, 1],
  },
  {
    title: "DRAW — par tranche de lH + lA (total attendu)",
    extract: lambdaTotal,
    edges: [2.2, 2.6, 3, 3.4],
  },
];

async function main() {
  const channels = ["VALUE", "DRAW", "SAFE", "DOMINANT", "BTTS", "GOALS"];
  // Dedup rolling-horizon passes: only the latest ModelRun per (fixture, channel).
  const rows = await prisma.$queryRaw<Row[]>`
    WITH latest AS (
      SELECT DISTINCT ON (mr."fixtureId", cd.channel)
        f."scheduledAt" AS "scheduledAt",
        cd.channel,
        cs.market,
        cs.pick,
        cs.probability,
        cs.odds,
        cs.ev,
        cs."qualityScore",
        (mr.features->>'lambdaHome')::float8 AS "lambdaHome",
        (mr.features->>'lambdaAway')::float8 AS "lambdaAway",
        cs.result
      FROM channel_decision cd
      JOIN model_run mr ON mr.id = cd."modelRunId"
      JOIN fixture f ON f.id = mr."fixtureId"
      JOIN channel_selection cs ON cs."channelDecisionId" = cd.id AND cs.rank = 1
      WHERE cd.status = 'SELECTED'
        AND cd.channel = ANY(${channels}::"StrategyChannel"[])
        AND cs.odds IS NOT NULL
      ORDER BY mr."fixtureId", cd.channel, mr."analyzedAt" DESC
    )
    SELECT
      "scheduledAt",
      channel,
      market,
      pick,
      probability::float8 AS probability,
      odds::float8 AS odds,
      ev::float8 AS ev,
      "qualityScore"::float8 AS "qualityScore",
      "lambdaHome",
      "lambdaAway",
      result
    FROM latest
    WHERE result IN ('WON', 'LOST')
    ORDER BY "scheduledAt"
  `;

  const lines: string[] = [];
  const w = (s = "") => lines.push(s);
  w("BACKTEST CLASSEMENT TOPN — modes value & draw (page Investir)");
  w(`Genere le ${new Date().toISOString()} — ${rows.length} picks settled (VALUE+DRAW)`);
  w(
    `Calibration leak-free : fenetre ${CALIBRATION_WINDOW_DAYS}j, min ${CALIBRATION_MIN_SAMPLES} samples, erreur mesuree avant le debut de chaque jour`,
  );
  w();

  const scoredByChannel = new Map<string, Map<string, ScoredPick[]>>();
  for (const channel of channels) {
    const channelRows = rows.filter((r) => r.channel === channel);
    scoredByChannel.set(channel, computeDailyScoredPicks(channelRows));
  }

  for (const pool of POOLS) {
    const scoredByDay = scoredByChannel.get(pool.channel);
    if (!scoredByDay || scoredByDay.size === 0) {
      w(`=== ${pool.label} : aucune donnee ===`);
      w();
      continue;
    }
    lines.push(...evaluatePool(pool, scoredByDay));
  }

  w("========== DIAGNOSTICS PAR TRANCHE (tous picks settled) ==========");
  w();
  for (const channel of ["VALUE", "DRAW"]) {
    const scoredByDay = scoredByChannel.get(channel);
    if (!scoredByDay) continue;
    const allPicks = [...scoredByDay.values()].flat();
    const specs = channel === "VALUE" ? VALUE_DIAGNOSTICS : DRAW_DIAGNOSTICS;
    for (const spec of specs) {
      lines.push(...bucketDiagnostics(allPicks, spec));
      w();
    }
  }

  const report = lines.join("\n");
  console.log(report);

  const reportDir = join(process.cwd(), "reports");
  mkdirSync(reportDir, { recursive: true });
  const filename = `backtest-invest-ranking-${new Date().toISOString().slice(0, 10)}.txt`;
  writeFileSync(join(reportDir, filename), report, "utf8");
  console.log(`\nRapport ecrit : reports/${filename}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
