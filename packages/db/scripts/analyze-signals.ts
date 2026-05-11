/// <reference types="node" />
/**
 * Signal quality analysis for coupon model training
 * Run: pnpm --filter @evcore/db db:analyze:signals [from=2026-04-01] [to=2026-05-10]
 * Output: packages/db/reports/signal-analysis-FROM_TO.txt
 *
 * Goal: identify signal thresholds that maximize pick correctness.
 * NOT about ROI — feeds a model that proposes winning coupons at target odds.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/client";

// ── Types ─────────────────────────────────────────────────────────────────────

type Canal = "EV" | "SV" | "BB" | "NUL" | "CONF";

type PickRecord = {
  fixtureId: string;
  date: string;
  comp: string;
  canal: Canal;
  pick: string;
  probability: number;
  qualityScore: number | null;
  ev: number | null;
  oddsSnapshot: number | null;
  lambdaHome: number | null;
  lambdaAway: number | null;
  xg: number | null;
  lambdaMin: number | null;
  deltaLambda: number | null;
  finalScore: number | null;
  deterministicScore: number | null;
  modelThreshold: number;
  isCorrect: boolean | null;
};

type HitStats = {
  n: number;
  correct: number;
  incorrect: number;
  pending: number;
  rate: number | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function readNumber(features: unknown, key: string): number | null {
  if (!features || typeof features !== "object") return null;
  const entry = features as Record<string, unknown>;
  const v = entry[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function hitStats(picks: PickRecord[]): HitStats {
  const correct = picks.filter((p) => p.isCorrect === true).length;
  const incorrect = picks.filter((p) => p.isCorrect === false).length;
  const pending = picks.filter((p) => p.isCorrect === null).length;
  return {
    n: picks.length,
    correct,
    incorrect,
    pending,
    rate: correct + incorrect > 0 ? correct / (correct + incorrect) : null,
  };
}

function fmtRate(rate: number | null, width = 6): string {
  if (rate === null) return "—".padStart(width);
  return `${(rate * 100).toFixed(1)}%`.padStart(width);
}

function arrow(rate: number | null): string {
  if (rate === null) return " ";
  if (rate >= 0.75) return "↑↑";
  if (rate >= 0.65) return "↑";
  if (rate >= 0.55) return "~";
  if (rate >= 0.45) return "↓";
  return "↓↓";
}

function getModelScoreThreshold(code: string): number {
  const map: Record<string, number> = {
    PL: 0.58,
    SA: 0.6,
    BL1: 0.55,
    LL: 0.58,
    L1: 0.58,
    J1: 0.55,
    MX1: 0.55,
    CH: 0.5,
    D2: 0.55,
    F2: 0.58,
    SP2: 0.62,
    I2: 0.6,
    EL1: 0.5,
    EL2: 0.45,
    UCL: 0.45,
    LDC: 0.45,
    UEL: 0.55,
    UECL: 0.45,
    WCQE: 0.6,
    FRI: 0.45,
    UNL: 0.6,
  };
  return map[code] ?? 0.6;
}

// ── Section renderers ─────────────────────────────────────────────────────────

function renderHitRateTable(picks: PickRecord[]): string[] {
  const lines: string[] = [];
  const w = (s = "") => lines.push(s);
  const canals: Canal[] = ["EV", "SV", "BB", "NUL", "CONF"];
  const p = (s: string, n: number) => s.padEnd(n);
  const pL = (s: string, n: number) => s.padStart(n);

  w(
    `  ${p("Canal", 8)}${pL("Picks", 7)}${pL("Correct", 9)}${pL("Incorrect", 11)}${pL("Pending", 9)}${pL("Taux", 8)}  Signal`,
  );
  w("  " + "─".repeat(58));

  let totalCorrect = 0;
  let totalIncorrect = 0;
  let totalPending = 0;

  for (const canal of canals) {
    const stats = hitStats(picks.filter((r) => r.canal === canal));
    totalCorrect += stats.correct;
    totalIncorrect += stats.incorrect;
    totalPending += stats.pending;
    w(
      `  ${p(canal, 8)}${pL(String(stats.n), 7)}${pL(String(stats.correct), 9)}${pL(String(stats.incorrect), 11)}${pL(String(stats.pending), 9)}${fmtRate(stats.rate, 8)}  ${arrow(stats.rate)}`,
    );
  }

  w("  " + "─".repeat(58));
  const total = totalCorrect + totalIncorrect + totalPending;
  const globalRate =
    totalCorrect + totalIncorrect > 0
      ? totalCorrect / (totalCorrect + totalIncorrect)
      : null;
  w(
    `  ${p("TOTAL", 8)}${pL(String(total), 7)}${pL(String(totalCorrect), 9)}${pL(String(totalIncorrect), 11)}${pL(String(totalPending), 9)}${fmtRate(globalRate, 8)}`,
  );

  return lines;
}

function renderCalibration(picks: PickRecord[], canal: Canal): string[] {
  const lines: string[] = [];
  const w = (s = "") => lines.push(s);
  const canalPicks = picks.filter((r) => r.canal === canal);

  const buckets = [
    { label: "50-55%", min: 0.5, max: 0.55, mid: 0.525 },
    { label: "55-60%", min: 0.55, max: 0.6, mid: 0.575 },
    { label: "60-65%", min: 0.6, max: 0.65, mid: 0.625 },
    { label: "65-70%", min: 0.65, max: 0.7, mid: 0.675 },
    { label: "70-75%", min: 0.7, max: 0.75, mid: 0.725 },
    { label: "75-80%", min: 0.75, max: 0.8, mid: 0.775 },
    { label: "80%+", min: 0.8, max: 1.01, mid: 0.85 },
  ];

  w(
    `    ${"Prob".padEnd(10)}  ${"Picks".padStart(6)}  ${"Prédit".padStart(7)}  ${"Réalisé".padStart(8)}  ${"Δ Calibration".padStart(14)}`,
  );
  w("    " + "─".repeat(54));

  for (const b of buckets) {
    const matching = canalPicks.filter(
      (r) => r.probability >= b.min && r.probability < b.max,
    );
    const stats = hitStats(matching);
    if (stats.n === 0) continue;

    if (stats.rate !== null) {
      const delta = stats.rate - b.mid;
      const deltaStr = `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)}%`;
      const flag =
        Math.abs(delta) < 0.05
          ? "✓"
          : delta > 0
            ? "↑ sur-réalisé"
            : "↓ sous-réalisé";
      w(
        `    ${b.label.padEnd(10)}  ${String(stats.n).padStart(6)}  ${(b.mid * 100).toFixed(1).padStart(6)}%  ${fmtRate(stats.rate, 7)}  ${deltaStr.padStart(9)}  ${flag}`,
      );
    } else {
      w(
        `    ${b.label.padEnd(10)}  ${String(stats.n).padStart(6)}  ${(b.mid * 100).toFixed(1).padStart(6)}%  ${"—".padStart(8)}  En cours`,
      );
    }
  }

  return lines;
}

type FeatureBucket = {
  label: string;
  min: number;
  max: number;
};

function renderBucketTable(
  picks: PickRecord[],
  getValue: (r: PickRecord) => number | null,
  buckets: FeatureBucket[],
  colLabel: string,
): string[] {
  const lines: string[] = [];
  const w = (s = "") => lines.push(s);

  w(
    `    ${colLabel.padEnd(12)}  ${"Picks".padStart(6)}  ${"Taux".padStart(7)}  Signal`,
  );

  for (const b of buckets) {
    const matching = picks.filter((r) => {
      const v = getValue(r);
      return v !== null && v >= b.min && v < b.max;
    });
    const stats = hitStats(matching);
    if (stats.n === 0) continue;
    w(
      `    ${b.label.padEnd(12)}  ${String(stats.n).padStart(6)}  ${fmtRate(stats.rate, 7)}  ${arrow(stats.rate)}`,
    );
  }

  return lines;
}

function renderBBFeatures(picks: PickRecord[]): string[] {
  const lines: string[] = [];
  const w = (s = "") => lines.push(s);
  const bbPicks = picks.filter((r) => r.canal === "BB");

  w("  xG total (λV1 + λV2)");
  for (const line of renderBucketTable(
    bbPicks,
    (r) => r.xg,
    [
      { label: "< 1.5", min: -Infinity, max: 1.5 },
      { label: "1.5-2.0", min: 1.5, max: 2.0 },
      { label: "2.0-2.5", min: 2.0, max: 2.5 },
      { label: "2.5-3.0", min: 2.5, max: 3.0 },
      { label: "3.0+", min: 3.0, max: Infinity },
    ],
    "xG",
  ))
    w(line);

  w();
  w("  λ_min (équipe la moins prolixe)");
  for (const line of renderBucketTable(
    bbPicks,
    (r) => r.lambdaMin,
    [
      { label: "< 0.4", min: -Infinity, max: 0.4 },
      { label: "0.4-0.6", min: 0.4, max: 0.6 },
      { label: "0.6-0.8", min: 0.6, max: 0.8 },
      { label: "0.8-1.0", min: 0.8, max: 1.0 },
      { label: "1.0+", min: 1.0, max: Infinity },
    ],
    "λ_min",
  ))
    w(line);

  w();
  const strongBB = bbPicks.filter(
    (r) =>
      r.xg !== null && r.lambdaMin !== null && r.xg > 2.5 && r.lambdaMin > 0.7,
  );
  const ss = hitStats(strongBB);
  w(
    `  Combiné xG>2.5 + λ_min>0.7 : ${ss.n} picks  Taux: ${fmtRate(ss.rate)}  ${arrow(ss.rate)}`,
  );

  return lines;
}

function renderNULFeatures(picks: PickRecord[]): string[] {
  const lines: string[] = [];
  const w = (s = "") => lines.push(s);
  const nulPicks = picks.filter((r) => r.canal === "NUL");

  w("  |Δλ| = |λV1 - λV2| (équilibre des équipes)");
  for (const line of renderBucketTable(
    nulPicks,
    (r) => r.deltaLambda,
    [
      { label: "0.0-0.2", min: 0, max: 0.2 },
      { label: "0.2-0.4", min: 0.2, max: 0.4 },
      { label: "0.4-0.6", min: 0.4, max: 0.6 },
      { label: "0.6+", min: 0.6, max: Infinity },
    ],
    "|Δλ|",
  ))
    w(line);

  w();
  w("  xG total");
  for (const line of renderBucketTable(
    nulPicks,
    (r) => r.xg,
    [
      { label: "< 1.5", min: -Infinity, max: 1.5 },
      { label: "1.5-2.0", min: 1.5, max: 2.0 },
      { label: "2.0-2.5", min: 2.0, max: 2.5 },
      { label: "2.5+", min: 2.5, max: Infinity },
    ],
    "xG",
  ))
    w(line);

  w();
  const strongNUL = nulPicks.filter(
    (r) =>
      r.deltaLambda !== null &&
      r.xg !== null &&
      r.deltaLambda < 0.2 &&
      r.xg < 2.2,
  );
  const ss = hitStats(strongNUL);
  w(
    `  Combiné |Δλ|<0.2 + xG<2.2 : ${ss.n} picks  Taux: ${fmtRate(ss.rate)}  ${arrow(ss.rate)}`,
  );

  return lines;
}

function renderEVSVFeatures(picks: PickRecord[], canal: "EV" | "SV"): string[] {
  const lines: string[] = [];
  const w = (s = "") => lines.push(s);
  const canalPicks = picks.filter((r) => r.canal === canal);

  w("  qualityScore");
  for (const line of renderBucketTable(
    canalPicks,
    (r) => r.qualityScore,
    [
      { label: "< 0.70", min: -Infinity, max: 0.7 },
      { label: "0.70-0.75", min: 0.7, max: 0.75 },
      { label: "0.75-0.80", min: 0.75, max: 0.8 },
      { label: "0.80-0.85", min: 0.8, max: 0.85 },
      { label: "0.85+", min: 0.85, max: Infinity },
    ],
    "QS",
  ))
    w(line);

  w();
  w("  EV");
  for (const line of renderBucketTable(
    canalPicks,
    (r) => r.ev,
    [
      { label: "0.08-0.12", min: 0.08, max: 0.12 },
      { label: "0.12-0.16", min: 0.12, max: 0.16 },
      { label: "0.16-0.20", min: 0.16, max: 0.2 },
      { label: "0.20+", min: 0.2, max: Infinity },
    ],
    "EV",
  ))
    w(line);

  w();
  w("  probabilité");
  for (const line of renderBucketTable(
    canalPicks,
    (r) => r.probability,
    [
      { label: "55-60%", min: 0.55, max: 0.6 },
      { label: "60-65%", min: 0.6, max: 0.65 },
      { label: "65-70%", min: 0.65, max: 0.7 },
      { label: "70%+", min: 0.7, max: 1.0 },
    ],
    "Prob",
  ))
    w(line);

  return lines;
}

function renderCONFFeatures(picks: PickRecord[]): string[] {
  const lines: string[] = [];
  const w = (s = "") => lines.push(s);
  const confPicks = picks.filter((r) => r.canal === "CONF");

  w("  Gap = finalScore − seuil ligue");
  for (const line of renderBucketTable(
    confPicks,
    (r) => (r.finalScore !== null ? r.finalScore - r.modelThreshold : null),
    [
      { label: "< 0.00", min: -Infinity, max: 0.0 },
      { label: "0.00-0.03", min: 0.0, max: 0.03 },
      { label: "0.03-0.07", min: 0.03, max: 0.07 },
      { label: "0.07-0.12", min: 0.07, max: 0.12 },
      { label: "0.12+", min: 0.12, max: Infinity },
    ],
    "Gap",
  ))
    w(line);

  w();
  w("  probabilité");
  for (const line of renderBucketTable(
    confPicks,
    (r) => r.probability,
    [
      { label: "50-60%", min: 0.5, max: 0.6 },
      { label: "60-65%", min: 0.6, max: 0.65 },
      { label: "65-70%", min: 0.65, max: 0.7 },
      { label: "70-75%", min: 0.7, max: 0.75 },
      { label: "75%+", min: 0.75, max: 1.0 },
    ],
    "Prob",
  ))
    w(line);

  return lines;
}

function renderWeeklyTrends(picks: PickRecord[], periodStart: Date): string[] {
  const lines: string[] = [];
  const w = (s = "") => lines.push(s);
  const canals: Canal[] = ["EV", "SV", "BB", "NUL", "CONF"];
  const MONTHS = [
    "jan",
    "fév",
    "mar",
    "avr",
    "mai",
    "juin",
    "juil",
    "août",
    "sep",
    "oct",
    "nov",
    "déc",
  ];

  const weekMap = new Map<number, PickRecord[]>();
  for (const pick of picks) {
    const d = new Date(`${pick.date}T00:00:00.000Z`);
    const dayDiff = Math.floor(
      (d.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    const wk = Math.floor(dayDiff / 7) + 1;
    if (!weekMap.has(wk)) weekMap.set(wk, []);
    weekMap.get(wk)!.push(pick);
  }

  const headerCanals = canals.map((c) => c.padStart(7)).join("  ");
  w(`  ${"Semaine".padEnd(24)}  ${headerCanals}`);
  w("  " + "─".repeat(24 + 2 + canals.length * 9));

  const sortedWeeks = [...weekMap.keys()].sort((a, b) => a - b);

  for (const wk of sortedWeeks) {
    const weekPicks = weekMap.get(wk)!;
    const wkStart = new Date(
      periodStart.getTime() + (wk - 1) * 7 * 24 * 60 * 60 * 1000,
    );
    const wkEnd = new Date(wkStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    const sm = MONTHS[wkStart.getUTCMonth()]!;
    const crossMonth =
      wkStart.getUTCMonth() !== wkEnd.getUTCMonth()
        ? ` ${MONTHS[wkEnd.getUTCMonth()]!}`
        : "";
    const label = `S${wk} (${wkStart.getUTCDate()}-${wkEnd.getUTCDate()}${crossMonth} ${sm})`;

    const rates = canals
      .map((canal) => {
        const stats = hitStats(weekPicks.filter((r) => r.canal === canal));
        return fmtRate(stats.rate, 7);
      })
      .join("  ");

    w(`  ${label.padEnd(24)}  ${rates}`);
  }

  return lines;
}

function renderLeagueBreakdown(picks: PickRecord[]): string[] {
  const lines: string[] = [];
  const w = (s = "") => lines.push(s);
  const canals: Canal[] = ["EV", "SV", "BB", "NUL", "CONF"];

  const leagueMap = new Map<string, Map<Canal, PickRecord[]>>();
  for (const pick of picks) {
    if (!leagueMap.has(pick.comp)) leagueMap.set(pick.comp, new Map());
    const cm = leagueMap.get(pick.comp)!;
    if (!cm.has(pick.canal)) cm.set(pick.canal, []);
    cm.get(pick.canal)!.push(pick);
  }

  const sorted = [...leagueMap.entries()].sort(([, a], [, b]) => {
    const sumA = [...a.values()].reduce((s, arr) => s + arr.length, 0);
    const sumB = [...b.values()].reduce((s, arr) => s + arr.length, 0);
    return sumB - sumA;
  });

  w(
    `  ${"Ligue".padEnd(8)}  ${"Canal".padEnd(6)}  ${"Picks".padStart(6)}  ${"Correct".padStart(8)}  ${"Taux".padStart(7)}  Signal`,
  );
  w("  " + "─".repeat(54));

  for (const [league, canalMap] of sorted) {
    let first = true;
    for (const canal of canals) {
      const cp = canalMap.get(canal) ?? [];
      if (cp.length < 3) continue;
      const stats = hitStats(cp);
      w(
        `  ${(first ? league : "").padEnd(8)}  ${canal.padEnd(6)}  ${String(stats.n).padStart(6)}  ${String(stats.correct).padStart(8)}  ${fmtRate(stats.rate, 7)}  ${arrow(stats.rate)}`,
      );
      first = false;
    }
  }

  return lines;
}

function renderCouponAnalysis(picks: PickRecord[]): string[] {
  const lines: string[] = [];
  const w = (s = "") => lines.push(s);
  const canals: Canal[] = ["EV", "SV", "BB", "NUL", "CONF"];

  const dateMap = new Map<string, PickRecord[]>();
  for (const pick of picks) {
    if (!dateMap.has(pick.date)) dateMap.set(pick.date, []);
    dateMap.get(pick.date)!.push(pick);
  }
  const dates = [...dateMap.keys()].sort();

  // Best pick per canal per day (highest qualityScore or probability)
  const topByCanal = new Map<Canal, Map<string, PickRecord>>();
  for (const canal of canals) {
    const dayMap = new Map<string, PickRecord>();
    for (const date of dates) {
      const dayPicks = (dateMap.get(date) ?? []).filter(
        (r) => r.canal === canal,
      );
      if (dayPicks.length === 0) continue;
      const best = dayPicks.reduce((acc, curr) => {
        const aScore = acc.qualityScore ?? acc.probability;
        const cScore = curr.qualityScore ?? curr.probability;
        return cScore > aScore ? curr : acc;
      });
      dayMap.set(date, best);
    }
    topByCanal.set(canal, dayMap);
  }

  w(`  ${dates.length} jours couverts`);
  w();
  w("  Meilleur pick par jour par canal (qualityScore ou prob max) :");
  w();
  w(
    `  ${"Canal".padEnd(6)}  ${"Jours".padStart(6)}  ${"Correct".padStart(8)}  ${"Taux".padStart(7)}  Signal`,
  );
  w("  " + "─".repeat(44));

  for (const canal of canals) {
    const dayMap = topByCanal.get(canal)!;
    const topPicks = [...dayMap.values()];
    const resolved = topPicks.filter((r) => r.isCorrect !== null);
    const correct = resolved.filter((r) => r.isCorrect === true).length;
    const rate = resolved.length > 0 ? correct / resolved.length : null;
    w(
      `  ${canal.padEnd(6)}  ${String(topPicks.length).padStart(6)}  ${String(correct).padStart(8)}  ${fmtRate(rate, 7)}  ${arrow(rate)}`,
    );
  }

  w();
  w("  Co-occurrence paires — les deux canaux corrects le même jour :");
  w();
  w(
    `  ${"Paire".padEnd(12)}  ${"Jours communs".padStart(14)}  ${"Co-corrects".padStart(12)}  ${"Taux".padStart(7)}`,
  );
  w("  " + "─".repeat(52));

  type PairResult = {
    label: string;
    common: number;
    coCorrect: number;
    rate: number | null;
  };
  const pairResults: PairResult[] = [];

  for (let i = 0; i < canals.length; i++) {
    for (let j = i + 1; j < canals.length; j++) {
      const c1 = canals[i]!;
      const c2 = canals[j]!;
      const dm1 = topByCanal.get(c1)!;
      const dm2 = topByCanal.get(c2)!;

      const commonDates = dates.filter(
        (d) =>
          dm1.has(d) &&
          dm2.has(d) &&
          dm1.get(d)!.isCorrect !== null &&
          dm2.get(d)!.isCorrect !== null,
      );
      const coCorrect = commonDates.filter(
        (d) => dm1.get(d)!.isCorrect === true && dm2.get(d)!.isCorrect === true,
      ).length;
      const rate =
        commonDates.length > 0 ? coCorrect / commonDates.length : null;
      pairResults.push({
        label: `${c1}+${c2}`,
        common: commonDates.length,
        coCorrect,
        rate,
      });
    }
  }

  pairResults.sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));

  for (const pair of pairResults) {
    w(
      `  ${pair.label.padEnd(12)}  ${String(pair.common).padStart(14)}  ${String(pair.coCorrect).padStart(12)}  ${fmtRate(pair.rate, 7)}`,
    );
  }

  w();
  w("  Triplets — les trois canaux corrects le même jour :");
  w();
  w(
    `  ${"Triplet".padEnd(18)}  ${"Jours communs".padStart(14)}  ${"Tri-corrects".padStart(13)}  ${"Taux".padStart(7)}`,
  );
  w("  " + "─".repeat(58));

  type TripleResult = {
    label: string;
    common: number;
    correct: number;
    rate: number | null;
  };
  const tripleResults: TripleResult[] = [];

  for (let i = 0; i < canals.length; i++) {
    for (let j = i + 1; j < canals.length; j++) {
      for (let k = j + 1; k < canals.length; k++) {
        const c1 = canals[i]!;
        const c2 = canals[j]!;
        const c3 = canals[k]!;
        const dm1 = topByCanal.get(c1)!;
        const dm2 = topByCanal.get(c2)!;
        const dm3 = topByCanal.get(c3)!;

        const commonDates = dates.filter(
          (d) =>
            dm1.has(d) &&
            dm2.has(d) &&
            dm3.has(d) &&
            dm1.get(d)!.isCorrect !== null &&
            dm2.get(d)!.isCorrect !== null &&
            dm3.get(d)!.isCorrect !== null,
        );
        const coCorrect = commonDates.filter(
          (d) =>
            dm1.get(d)!.isCorrect === true &&
            dm2.get(d)!.isCorrect === true &&
            dm3.get(d)!.isCorrect === true,
        ).length;
        const rate =
          commonDates.length > 0 ? coCorrect / commonDates.length : null;
        tripleResults.push({
          label: `${c1}+${c2}+${c3}`,
          common: commonDates.length,
          correct: coCorrect,
          rate,
        });
      }
    }
  }

  tripleResults.sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));

  for (const triple of tripleResults) {
    w(
      `  ${triple.label.padEnd(18)}  ${String(triple.common).padStart(14)}  ${String(triple.correct).padStart(13)}  ${fmtRate(triple.rate, 7)}`,
    );
  }

  return lines;
}

// ── Section 7 : Volume journalier par canal ───────────────────────────────────

function renderDailyVolume(picks: PickRecord[]): string[] {
  const lines: string[] = [];
  const w = (s = "") => lines.push(s);
  const canals: Canal[] = ["EV", "SV", "BB", "CONF"];

  const dateMap = new Map<string, PickRecord[]>();
  for (const pick of picks) {
    if (!dateMap.has(pick.date)) dateMap.set(pick.date, []);
    dateMap.get(pick.date)!.push(pick);
  }
  const allDates = [...dateMap.keys()].sort();
  const totalDays = allDates.length;

  const probThresholds = [0.5, 0.55, 0.6, 0.65, 0.7];

  for (const canal of canals) {
    w(`  ── ${canal} ──`);
    w(
      `    ${"Seuil prob".padEnd(12)}  ${"Jours actifs".padStart(12)}  ${"Moy/jour".padStart(9)}  ${"1 pick".padStart(7)}  ${"2-3 picks".padStart(10)}  ${"4+ picks".padStart(9)}  ${"Taux".padStart(7)}`,
    );
    w("    " + "─".repeat(72));

    for (const thr of probThresholds) {
      const activeDays: Array<{
        date: string;
        n: number;
        correct: number;
        incorrect: number;
      }> = [];

      for (const date of allDates) {
        const dayPicks = (dateMap.get(date) ?? []).filter(
          (r) => r.canal === canal && r.probability >= thr,
        );
        if (dayPicks.length === 0) continue;
        activeDays.push({
          date,
          n: dayPicks.length,
          correct: dayPicks.filter((r) => r.isCorrect === true).length,
          incorrect: dayPicks.filter((r) => r.isCorrect === false).length,
        });
      }

      const active = activeDays.length;
      const avg =
        active > 0
          ? (activeDays.reduce((s, d) => s + d.n, 0) / active).toFixed(1)
          : "—";
      const d1 = activeDays.filter((d) => d.n === 1).length;
      const d23 = activeDays.filter((d) => d.n >= 2 && d.n <= 3).length;
      const d4 = activeDays.filter((d) => d.n >= 4).length;

      const totalCorrect = activeDays.reduce((s, d) => s + d.correct, 0);
      const totalIncorrect = activeDays.reduce((s, d) => s + d.incorrect, 0);
      const rate =
        totalCorrect + totalIncorrect > 0
          ? totalCorrect / (totalCorrect + totalIncorrect)
          : null;

      const thrLabel = `>${(thr * 100).toFixed(0)}%`;
      const activeLabel = `${active}/${totalDays}`;
      w(
        `    ${thrLabel.padEnd(12)}  ${activeLabel.padStart(12)}  ${String(avg).padStart(9)}  ${String(d1).padStart(7)}  ${String(d23).padStart(10)}  ${String(d4).padStart(9)}  ${fmtRate(rate, 7)}`,
      );
    }
    w();
  }

  return lines;
}

// ── Section 8 : Tendance par jour de semaine ──────────────────────────────────

function renderDayOfWeekTrends(picks: PickRecord[]): string[] {
  const lines: string[] = [];
  const w = (s = "") => lines.push(s);
  const canals: Canal[] = ["EV", "SV", "BB", "NUL", "CONF"];
  const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  // Group picks by day of week (0=Sun in JS → remap to Mon=0)
  const dowMap = new Map<number, PickRecord[]>();
  for (let i = 0; i < 7; i++) dowMap.set(i, []);

  for (const pick of picks) {
    const d = new Date(`${pick.date}T12:00:00.000Z`);
    const dow = (d.getUTCDay() + 6) % 7; // Mon=0, Sun=6
    dowMap.get(dow)!.push(pick);
  }

  const headerCanals = canals.map((c) => c.padStart(7)).join("  ");
  const totalPicks = canals.map(() => "Picks".padStart(7)).join("  ");
  w(`  ${"Jour".padEnd(6)}  ${"Matchs".padStart(7)}  ${headerCanals}`);
  w("  " + "─".repeat(6 + 2 + 7 + 2 + canals.length * 9));

  // also need dates per dow for "matchs" count
  const dateMap = new Map<string, PickRecord[]>();
  for (const pick of picks) {
    if (!dateMap.has(pick.date)) dateMap.set(pick.date, []);
    dateMap.get(pick.date)!.push(pick);
  }
  const datesByDow = new Map<number, Set<string>>();
  for (let i = 0; i < 7; i++) datesByDow.set(i, new Set());
  for (const date of dateMap.keys()) {
    const d = new Date(`${date}T12:00:00.000Z`);
    const dow = (d.getUTCDay() + 6) % 7;
    datesByDow.get(dow)!.add(date);
  }

  for (let dow = 0; dow < 7; dow++) {
    const dayPicks = dowMap.get(dow)!;
    const dayCount = datesByDow.get(dow)!.size;
    if (dayPicks.length === 0) continue;

    const rates = canals
      .map((canal) => {
        const stats = hitStats(dayPicks.filter((r) => r.canal === canal));
        return fmtRate(stats.rate, 7);
      })
      .join("  ");

    w(
      `  ${DAY_LABELS[dow]!.padEnd(6)}  ${String(dayCount).padStart(7)}  ${rates}`,
    );
  }

  w();

  // volume row (picks/jour moyen par canal)
  w("  Picks moyen émis par jour de match :");
  w(`  ${"Jour".padEnd(6)}  ${"".padStart(7)}  ${totalPicks}`);
  w("  " + "─".repeat(6 + 2 + 7 + 2 + canals.length * 9));

  for (let dow = 0; dow < 7; dow++) {
    const dayPicks = dowMap.get(dow)!;
    const dayCount = datesByDow.get(dow)!.size;
    if (dayPicks.length === 0) continue;

    const avgs = canals
      .map((canal) => {
        const cp = dayPicks.filter((r) => r.canal === canal);
        const avg = dayCount > 0 ? (cp.length / dayCount).toFixed(1) : "—";
        return avg.padStart(7);
      })
      .join("  ");

    w(
      `  ${DAY_LABELS[dow]!.padEnd(6)}  ${String(dayCount).padStart(7)}  ${avgs}`,
    );
  }

  return lines;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const fromArg = process.argv[2] ?? "2026-04-01";
  const toArg = process.argv[3] ?? "2026-05-10";

  const periodStart = new Date(`${fromArg}T00:00:00.000Z`);
  const periodEnd = new Date(`${toArg}T23:59:59.999Z`);

  console.log(`Chargement des fixtures du ${fromArg} au ${toArg}…`);

  const fixtures = await prisma.fixture.findMany({
    where: { scheduledAt: { gte: periodStart, lte: periodEnd } },
    select: {
      id: true,
      scheduledAt: true,
      season: {
        select: { competition: { select: { code: true } } },
      },
      predictions: {
        select: {
          channel: true,
          market: true,
          pick: true,
          probability: true,
          correct: true,
        },
      },
      modelRuns: {
        select: {
          deterministicScore: true,
          finalScore: true,
          features: true,
          analyzedAt: true,
          bets: {
            select: {
              market: true,
              pick: true,
              ev: true,
              qualityScore: true,
              probEstimated: true,
              oddsSnapshot: true,
              isSafeValue: true,
              status: true,
            },
            orderBy: [
              { qualityScore: { sort: "desc", nulls: "last" } },
              { ev: "desc" },
            ],
          },
        },
        orderBy: { analyzedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { scheduledAt: "asc" },
  });

  console.log(`${fixtures.length} fixtures chargées. Aplatissement…`);

  // ── Flatten to PickRecord[] ─────────────────────────────────────────────────

  const picks: PickRecord[] = [];

  for (const f of fixtures) {
    const date = f.scheduledAt.toISOString().slice(0, 10);
    const comp = f.season.competition.code;
    const modelThreshold = getModelScoreThreshold(comp);
    const run = f.modelRuns[0];
    const feat = run?.features;

    const lambdaHome = readNumber(feat, "lambdaHome");
    const lambdaAway = readNumber(feat, "lambdaAway");
    const xg =
      lambdaHome !== null && lambdaAway !== null
        ? lambdaHome + lambdaAway
        : null;
    const lambdaMin =
      lambdaHome !== null && lambdaAway !== null
        ? Math.min(lambdaHome, lambdaAway)
        : null;
    const deltaLambda =
      lambdaHome !== null && lambdaAway !== null
        ? Math.abs(lambdaHome - lambdaAway)
        : null;
    const finalScore = run?.finalScore ? Number(run.finalScore) : null;
    const deterministicScore = run?.deterministicScore
      ? Number(run.deterministicScore)
      : null;

    if (run) {
      for (const bet of run.bets) {
        const canal: Canal = bet.isSafeValue ? "SV" : "EV";
        const isCorrect =
          bet.status === "WON" ? true : bet.status === "LOST" ? false : null;
        picks.push({
          fixtureId: f.id,
          date,
          comp,
          canal,
          pick: bet.pick,
          probability: Number(bet.probEstimated),
          qualityScore: bet.qualityScore ? Number(bet.qualityScore) : null,
          ev: Number(bet.ev),
          oddsSnapshot: bet.oddsSnapshot ? Number(bet.oddsSnapshot) : null,
          lambdaHome,
          lambdaAway,
          xg,
          lambdaMin,
          deltaLambda,
          finalScore,
          deterministicScore,
          modelThreshold,
          isCorrect,
        });
      }
    }

    for (const pred of f.predictions) {
      if (
        pred.channel !== "BTTS" &&
        pred.channel !== "DRAW" &&
        pred.channel !== "CONF"
      ) {
        continue;
      }
      const canal: Canal =
        pred.channel === "BTTS"
          ? "BB"
          : pred.channel === "DRAW"
            ? "NUL"
            : "CONF";

      picks.push({
        fixtureId: f.id,
        date,
        comp,
        canal,
        pick: pred.pick,
        probability: Number(pred.probability),
        qualityScore: null,
        ev: null,
        oddsSnapshot: null,
        lambdaHome,
        lambdaAway,
        xg,
        lambdaMin,
        deltaLambda,
        finalScore,
        deterministicScore,
        modelThreshold,
        isCorrect: pred.correct,
      });
    }
  }

  console.log(`${picks.length} picks aplatis. Génération du rapport…`);

  // ── Render ─────────────────────────────────────────────────────────────────

  const lines: string[] = [];
  const w = (s = "") => lines.push(s);
  const SEP = "═".repeat(64);
  const generatedAt =
    new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

  const totalDays = new Set(picks.map((r) => r.date)).size;
  const resolved = picks.filter((r) => r.isCorrect !== null).length;

  w(SEP);
  w(`  EVCore — Analyse Signaux — ${fromArg} → ${toArg}`);
  w(`  Généré : ${generatedAt}`);
  w(
    `  ${fixtures.length} fixtures | ${totalDays} jours | ${picks.length} picks émis | ${resolved} résolus`,
  );
  w(SEP);
  w();

  w(
    "━━━ 1. TAUX DE RÉUSSITE PAR CANAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  );
  w();
  for (const line of renderHitRateTable(picks)) w(line);
  w();

  w(
    "━━━ 2. CALIBRATION — Probabilité déclarée vs réalisée ━━━━━━━━━━━━━━━━━━━━",
  );
  w();
  for (const canal of ["EV", "SV", "BB", "NUL", "CONF"] as Canal[]) {
    const cp = picks.filter((r) => r.canal === canal);
    if (cp.length === 0) continue;
    w(
      `  ── ${canal} ─────────────────────────────────────────────────────────────`,
    );
    for (const line of renderCalibration(picks, canal)) w(line);
    w();
  }

  w(
    "━━━ 3. ANALYSE FEATURES PAR CANAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  );
  w();
  w(
    "  ── BB (BTTS) ──────────────────────────────────────────────────────────",
  );
  for (const line of renderBBFeatures(picks)) w(line);
  w();
  w(
    "  ── NUL (match nul) ────────────────────────────────────────────────────",
  );
  for (const line of renderNULFeatures(picks)) w(line);
  w();
  w(
    "  ── EV ──────────────────────────────────────────────────────────────────",
  );
  for (const line of renderEVSVFeatures(picks, "EV")) w(line);
  w();
  w(
    "  ── SV ──────────────────────────────────────────────────────────────────",
  );
  for (const line of renderEVSVFeatures(picks, "SV")) w(line);
  w();
  w(
    "  ── CONF ────────────────────────────────────────────────────────────────",
  );
  for (const line of renderCONFFeatures(picks)) w(line);
  w();

  w(
    "━━━ 4. TENDANCES HEBDOMADAIRES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  );
  w();
  for (const line of renderWeeklyTrends(picks, periodStart)) w(line);
  w();

  w(
    "━━━ 5. TENDANCE PAR JOUR DE SEMAINE (Lun → Dim) ━━━━━━━━━━━━━━━━━━━━━━━━━",
  );
  w();
  for (const line of renderDayOfWeekTrends(picks)) w(line);
  w();

  w(
    "━━━ 6. VOLUME JOURNALIER PAR CANAL ET SEUIL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  );
  w(
    "  Lecture : combien de jours avaient ≥1 pick à ce seuil, et quelle distribution",
  );
  w();
  for (const line of renderDailyVolume(picks)) w(line);
  w();

  w(
    "━━━ 7. ANALYSE PAR LIGUE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  );
  w();
  for (const line of renderLeagueBreakdown(picks)) w(line);
  w();

  w(
    "━━━ 8. SIMULATION COUPON — Co-occurrence canaux ━━━━━━━━━━━━━━━━━━━━━━━━━━",
  );
  w();
  for (const line of renderCouponAnalysis(picks)) w(line);

  w();
  w(SEP);

  const output = lines.join("\n");
  console.log("\n" + output);

  const reportsDir = join(__dirname, "..", "reports");
  mkdirSync(reportsDir, { recursive: true });
  const filePath = join(reportsDir, `signal-analysis-${fromArg}_${toArg}.txt`);
  writeFileSync(filePath, output, "utf-8");
  console.log(`\nReport saved → ${filePath}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
