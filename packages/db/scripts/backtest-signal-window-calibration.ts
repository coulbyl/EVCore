/// <reference types="node" />
/**
 * ⚠️ OBSOLÈTE (2026-08-22) — ce script calibre `k` / `decayHalfLifeDays` /
 * `windowDays` / `nLeagueMin` de `SignalWindowService.computeSignalWindow`,
 * c'est-à-dire la fenêtre glissante de 38 jours et le `signalScore` qui en
 * dérivait. Les deux ont été SUPPRIMÉS : `signalScore` a été mesuré
 * anti-prédictif à probabilité constante (0.681 contre 0.631 selon qu'il est
 * bas ou haut, -5.0 points ± 2.0, même sens sur les 4 bandes de probabilité).
 * La calibration des jambes passe désormais par les courbes de fiabilité par
 * canal (`channel-reliability.ts`). Ne pas relancer ce script pour régler
 * quoi que ce soit.
 */
/**
 * `k` / `decayHalfLifeDays` / `windowDays` / `capMin` / `capMax`
 * (`COUPON_PARAMS`) drive `SignalWindowService.computeSignalWindow`'s
 * per-canal calibrated hit rate — never re-validated (no surviving
 * backtest, cf. coupon.constants.ts header). Full pipeline resimulation
 * (pool selection + composition) is out of scope for a first pass — this
 * tests the narrower, well-posed question these parameters actually exist
 * to answer: "as a day-ahead probability estimate for a canal, how close is
 * `calibrate()`'s output to what actually happens?" (Brier score, lower is
 * better), walked forward day by day exactly like production (leak-free —
 * only data strictly before the evaluated day feeds its estimate).
 *
 * Re-implements `decayWeight`/`hitsForWeighted`/`calibrate` verbatim from
 * signal-window.service.ts — keep in sync (packages/db doesn't depend on
 * apps/backend, same convention as every other script here).
 *
 * One-factor-at-a-time sensitivity (not a full cross grid): each dimension
 * is varied with the other two held at their current live value, split
 * train/valid 60/40 by day like every other backtest this session.
 *
 * Run: pnpm --filter @evcore/db db:backtest:signal-window-calibration
 * Output: packages/db/reports/backtest-signal-window-calibration-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/client";

// Current live values (coupon.constants.ts COUPON_PARAMS) — the baseline
// every alternative is measured against.
const LIVE_K = 20;
const LIVE_DECAY_HALF_LIFE_DAYS = 14;
const LIVE_WINDOW_DAYS = 38;
const LIVE_CAP_MIN = 0.05;
const LIVE_CAP_MAX = 0.8;

// Mirrors CANAL_BASE_WEIGHT (coupon.constants.ts) — duplicated for the same
// reason as everything else here: packages/db can't import apps/backend.
const CANAL_BASE_WEIGHT: Record<string, number> = {
  SAFE: 0.74,
  DOMINANT: 0.66,
  BTTS: 0.62,
  VALUE: 0.36,
  DRAW: 0.2,
};
const CANALS = Object.keys(CANAL_BASE_WEIGHT);

const K_GRID = [5, 10, 15, 20, 30, 50, 80];
const DECAY_GRID = [7, 14, 21, 30, 45, 60, 9999];
const WINDOW_GRID = [14, 21, 30, 38, 50, 75, 100];

const TRAIN_SPLIT = 0.6;
const DAY_MS = 86_400_000;

type Entry = {
  day: Date;
  channel: string;
  correct: boolean;
  count: number;
};

function decayWeight(
  dayMs: number,
  nowMs: number,
  halfLifeDays: number,
): number {
  const daysAgo = (nowMs - dayMs) / DAY_MS;
  return Math.pow(0.5, daysAgo / halfLifeDays);
}

function hitsForWeighted(
  entries: Entry[],
  nowMs: number,
  halfLifeDays: number,
): { correct: number; total: number } {
  let correct = 0;
  let total = 0;
  for (const e of entries) {
    const w = decayWeight(e.day.getTime(), nowMs, halfLifeDays) * e.count;
    total += w;
    if (e.correct) correct += w;
  }
  return { correct, total };
}

function calibrate(
  weightedCorrect: number,
  weightedTotal: number,
  prior: number,
  k: number,
  capMin: number,
  capMax: number,
): number {
  const raw = (weightedCorrect + k * prior) / (weightedTotal + k);
  return Math.min(capMax, Math.max(capMin, raw));
}

async function fetchAllEntries(): Promise<Entry[]> {
  const rows = await prisma.$queryRaw<
    { day: Date; channel: string; is_won: boolean; cnt: bigint }[]
  >`
    SELECT
      DATE(f."scheduledAt")   AS day,
      cd.channel              AS channel,
      (b.status = 'WON')      AS is_won,
      COUNT(*)                AS cnt
    FROM bet b
    JOIN channel_selection cs ON cs.id = b."channelSelectionId"
    JOIN channel_decision  cd ON cd.id = cs."channelDecisionId"
    JOIN fixture     f ON f.id = b."fixtureId"
    WHERE b.status IN ('WON', 'LOST')
      AND b.source = 'MODEL'
    GROUP BY DATE(f."scheduledAt"), cd.channel, b.status
  `;
  return rows.map((r) => ({
    day: r.day,
    channel: r.channel,
    correct: r.is_won,
    count: Number(r.cnt),
  }));
}

type WalkResult = { brierSum: number; n: number };

function emptyWalk(): WalkResult {
  return { brierSum: 0, n: 0 };
}

// Walk forward day by day: for each day D with >=1 settled bet for a canal,
// estimate that canal's calibrated rate from entries strictly before D
// (leak-free, matches computeSignalWindow's `since`/`asOf` semantics), then
// score it against what actually happened on D (Brier: (estimate-outcome)^2,
// per settled bet that day — repeats the day's single estimate once per bet,
// which naturally weights by that day's volume).
function walkForward(
  entries: Entry[],
  params: {
    k: number;
    decayHalfLifeDays: number;
    windowDays: number;
    capMin: number;
    capMax: number;
  },
  splitKey: string,
): { train: WalkResult; valid: WalkResult; overall: WalkResult } {
  const byCanal = new Map<string, Entry[]>();
  for (const e of entries) {
    const arr = byCanal.get(e.channel);
    if (arr) arr.push(e);
    else byCanal.set(e.channel, [e]);
  }

  const train = emptyWalk();
  const valid = emptyWalk();
  const overall = emptyWalk();

  for (const [canal, canalEntries] of byCanal) {
    const prior = CANAL_BASE_WEIGHT[canal];
    if (prior === undefined) continue; // unmodelled channel (e.g. TEAM_TOTAL) — out of scope here

    const days = Array.from(
      new Set(canalEntries.map((e) => e.day.toISOString().slice(0, 10))),
    ).sort();
    for (const dayKey of days) {
      const dayMs = new Date(`${dayKey}T00:00:00.000Z`).getTime();
      const since = dayMs - params.windowDays * DAY_MS;
      const priorEntries = canalEntries.filter(
        (e) => e.day.getTime() >= since && e.day.getTime() < dayMs,
      );
      const { correct, total } = hitsForWeighted(
        priorEntries,
        dayMs,
        params.decayHalfLifeDays,
      );
      const estimate = calibrate(
        correct,
        total,
        prior,
        params.k,
        params.capMin,
        params.capMax,
      );

      const todaysEntries = canalEntries.filter(
        (e) => e.day.toISOString().slice(0, 10) === dayKey,
      );
      for (const e of todaysEntries) {
        const outcome = e.correct ? 1 : 0;
        const brier = (estimate - outcome) ** 2 * e.count;
        overall.brierSum += brier;
        overall.n += e.count;
        const bucket = dayKey < splitKey ? train : valid;
        bucket.brierSum += brier;
        bucket.n += e.count;
      }
    }
  }

  return { train, valid, overall };
}

function formatWalk(w: WalkResult): string {
  if (w.n === 0) return "n=0";
  return `n=${w.n}, Brier=${(w.brierSum / w.n).toFixed(4)}`;
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-signal-window-calibration-${dateLabel}.txt`,
  );
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };

  out("═══════════════════════════════════════════════════════");
  out(
    "  EVCore — Calibration SignalWindowService (k / decayHalfLifeDays / windowDays)",
  );
  out(
    `  ${dateLabel} — Brier score walk-forward jour par jour, plus bas = mieux`,
  );
  out("═══════════════════════════════════════════════════════");

  const allEntries = await fetchAllEntries();
  const dayKeys = Array.from(
    new Set(allEntries.map((e) => e.day.toISOString().slice(0, 10))),
  ).sort();
  const splitIndex = Math.floor(dayKeys.length * TRAIN_SPLIT);
  const splitKey = dayKeys[splitIndex] ?? "9999-12-31";
  out();
  out(
    `Jours avec paris réglés : ${dayKeys.length} (${dayKeys[0]} → ${dayKeys[dayKeys.length - 1]}) — split au ${splitKey}`,
  );

  const baseline = walkForward(
    allEntries,
    {
      k: LIVE_K,
      decayHalfLifeDays: LIVE_DECAY_HALF_LIFE_DAYS,
      windowDays: LIVE_WINDOW_DAYS,
      capMin: LIVE_CAP_MIN,
      capMax: LIVE_CAP_MAX,
    },
    splitKey,
  );
  out();
  out(
    `Référence LIVE (k=${LIVE_K}, decayHalfLifeDays=${LIVE_DECAY_HALF_LIFE_DAYS}, windowDays=${LIVE_WINDOW_DAYS}) :`,
  );
  out(`  overall : ${formatWalk(baseline.overall)}`);
  out(`  train   : ${formatWalk(baseline.train)}`);
  out(`  valid   : ${formatWalk(baseline.valid)}`);

  out();
  out("──── 1. Sensibilité à k (poids du prior bayésien) ────");
  for (const k of K_GRID) {
    const r = walkForward(
      allEntries,
      {
        k,
        decayHalfLifeDays: LIVE_DECAY_HALF_LIFE_DAYS,
        windowDays: LIVE_WINDOW_DAYS,
        capMin: LIVE_CAP_MIN,
        capMax: LIVE_CAP_MAX,
      },
      splitKey,
    );
    const marker = k === LIVE_K ? " (actuel)" : "";
    out(
      `  k=${k}${marker} : train ${formatWalk(r.train)} | valid ${formatWalk(r.valid)}`,
    );
  }

  out();
  out("──── 2. Sensibilité à decayHalfLifeDays (décroissance de récence) ────");
  for (const d of DECAY_GRID) {
    const r = walkForward(
      allEntries,
      {
        k: LIVE_K,
        decayHalfLifeDays: d,
        windowDays: LIVE_WINDOW_DAYS,
        capMin: LIVE_CAP_MIN,
        capMax: LIVE_CAP_MAX,
      },
      splitKey,
    );
    const marker =
      d === LIVE_DECAY_HALF_LIFE_DAYS
        ? " (actuel)"
        : d === 9999
          ? " (quasi pas de décroissance)"
          : "";
    out(
      `  decayHalfLifeDays=${d}${marker} : train ${formatWalk(r.train)} | valid ${formatWalk(r.valid)}`,
    );
  }

  out();
  out("──── 3. Sensibilité à windowDays (fenêtre glissante) ────");
  for (const w of WINDOW_GRID) {
    const r = walkForward(
      allEntries,
      {
        k: LIVE_K,
        decayHalfLifeDays: LIVE_DECAY_HALF_LIFE_DAYS,
        windowDays: w,
        capMin: LIVE_CAP_MIN,
        capMax: LIVE_CAP_MAX,
      },
      splitKey,
    );
    const marker = w === LIVE_WINDOW_DAYS ? " (actuel)" : "";
    out(
      `  windowDays=${w}${marker} : train ${formatWalk(r.train)} | valid ${formatWalk(r.valid)}`,
    );
  }

  out();
  out(
    "──── 4. capMin/capMax — fréquence de saturation (bornes actuelles 0.05/0.8) ────",
  );
  let clamped = 0;
  let total = 0;
  for (const canal of CANALS) {
    const prior = CANAL_BASE_WEIGHT[canal]!;
    const canalEntries = allEntries.filter((e) => e.channel === canal);
    const days = Array.from(
      new Set(canalEntries.map((e) => e.day.toISOString().slice(0, 10))),
    ).sort();
    for (const dayKey of days) {
      const dayMs = new Date(`${dayKey}T00:00:00.000Z`).getTime();
      const since = dayMs - LIVE_WINDOW_DAYS * DAY_MS;
      const priorEntries = canalEntries.filter(
        (e) => e.day.getTime() >= since && e.day.getTime() < dayMs,
      );
      const { correct, total: weightedTotal } = hitsForWeighted(
        priorEntries,
        dayMs,
        LIVE_DECAY_HALF_LIFE_DAYS,
      );
      if (weightedTotal === 0) continue;
      const raw = (correct + LIVE_K * prior) / (weightedTotal + LIVE_K);
      total++;
      if (raw < LIVE_CAP_MIN || raw > LIVE_CAP_MAX) clamped++;
    }
  }
  out(
    `  Estimations (jour × canal) : ${total}, dont saturées : ${clamped} (${total > 0 ? ((clamped / total) * 100).toFixed(1) : "0"}%)`,
  );

  out();
  out("═══════════════════════════════════════════════════════");
  out("  Verdict : ne changer un paramètre que si son Brier train ET valid");
  out("  sont tous les deux <= à la référence LIVE — un seul suffit à");
  out("  rejeter (même logique de robustesse que les autres backtests).");
  out();
  out("  Hors scope (non testé ici, resimulation complète du pipeline non");
  out("  faite) : impact sur QUELLES jambes entrent dans le pool top-25 et");
  out("  sur le ROI final des coupons composés — seule la qualité de la");
  out("  calibration canal elle-même est mesurée.");
  out();
  out("  Note : `nLeagueMin` (COUPON_PARAMS) n'est référencé nulle part dans");
  out("  apps/backend — constante orpheline, hors scope de ce backtest.");
  out("═══════════════════════════════════════════════════════");

  const report = lines.join("\n");
  writeFileSync(outputPath, `${report}\n`, "utf8");
  console.log(`\nRapport écrit : reports/${outputPath.split("/").pop()}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
