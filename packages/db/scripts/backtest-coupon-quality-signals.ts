/// <reference types="node" />
/**
 * Formalise les analyses ad hoc de la session du 2026-08-09 (plan
 * "Générateur de coupon : sélection intelligente + coupons longshot
 * multi-jours") sur les vrais `Bet` réglés (source=MODEL) :
 *
 *  - stabilité d'un pick dans le temps (nb d'analyses antérieures où le même
 *    (market, pick) était déjà retenu pour la fixture — `priorAnalysisCount`,
 *    apps/backend/.../signal-window.service.ts::countPriorAnalyses)
 *  - cohérence interne du modèle (`shadow_predictions.conflict`)
 *  - déséquilibre offensif (`offensiveBalance.classification`)
 *  - matrice AVOID à 4 régimes (CLEAN/FADE/DROP/KEEP — voir
 *    apps/backend/.../signal-window.service.ts::classifyAvoidSignal), avec
 *    le ROI du pick inverse pour la branche FADE (cote du pick opposé lue
 *    dans odds_snapshot, au dernier snapshot avant le coup d'envoi)
 *
 * Split temporel 60/40 (même convention que backtest-invest-ranking.ts) pour
 * vérifier que chaque signal tient en forward, pas seulement sur la période
 * (semaine du 04-08 août) qui l'a fait émerger.
 *
 * AVOID_MAX_EDGE ci-dessous doit rester synchronisé avec
 * apps/backend/src/modules/betting-engine/strategies/channel-strategy.config.ts
 * (AVOID_CONFIG.maxEdge) — packages/db ne dépend pas d'apps/backend (même
 * convention que les autres scripts de ce dossier, cf. H2H_GAMMA dans
 * backtest-h2h-market-signals-combined.ts).
 *
 * Run: pnpm --filter @evcore/db db:backtest:coupon-quality-signals
 * Output: packages/db/reports/backtest-coupon-quality-signals-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/client";

const AVOID_MAX_EDGE = 0.3;
const TRAIN_SPLIT = 0.6;
const MIN_SAMPLE = 15;

type BaseRow = {
  id: string;
  market: string;
  pick: string;
  prob: number;
  odds: number;
  won: boolean;
  fixtureId: string;
  scheduledAt: Date;
  calibAlert: boolean;
  offensiveBalance: "BALANCED" | "ASYMMETRIC" | "STRONGLY_ASYMMETRIC" | null;
  shadowConflict: boolean | null;
  priorAnalysisCount: number;
};

type Period = "overall" | "train" | "valid";

function toNum(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}

function isExtremeDivergence(prob: number, odds: number): boolean {
  return prob - 1 / odds >= AVOID_MAX_EDGE;
}

// Mirrors signal-window.service.ts::oppositePick — YES/NO flip, or
// OVER_x/UNDER_x flip (covers OVER_UNDER(_HT) and TEAM_TOTAL_HOME/AWAY, which
// share the same pick naming).
function oppositePick(pick: string): string | null {
  if (pick === "YES") return "NO";
  if (pick === "NO") return "YES";
  if (pick === "OVER") return "UNDER";
  if (pick === "UNDER") return "OVER";
  if (pick.startsWith("OVER_")) return `UNDER_${pick.slice("OVER_".length)}`;
  if (pick.startsWith("UNDER_")) return `OVER_${pick.slice("UNDER_".length)}`;
  return null;
}

type Stats = { n: number; won: number; roiPct: number; hitPct: number };

function computeStats(rows: { won: boolean; odds: number }[]): Stats {
  const n = rows.length;
  const won = rows.filter((r) => r.won).length;
  const pnl = rows.reduce((sum, r) => sum + (r.won ? r.odds - 1 : -1), 0);
  return {
    n,
    won,
    roiPct: n > 0 ? (pnl / n) * 100 : 0,
    hitPct: n > 0 ? (won / n) * 100 : 0,
  };
}

function formatStats(s: Stats): string {
  if (s.n === 0) return "n=0";
  const flag = s.n < MIN_SAMPLE ? " (n<seuil, non concluant)" : "";
  return `n=${s.n}, hit=${s.hitPct.toFixed(1)}%, ROI=${s.roiPct.toFixed(2)}%${flag}`;
}

async function fetchBaseRows(): Promise<BaseRow[]> {
  const rows = await prisma.$queryRaw<
    {
      id: string;
      market: string;
      pick: string;
      prob: number;
      odds: number;
      status: string;
      fixtureId: string;
      scheduledAt: Date;
      calibAlert: boolean;
      offensiveBalance: string | null;
      shadowConflict: boolean | null;
      priorAnalysisCount: bigint;
    }[]
  >`
    SELECT
      b.id,
      b.market,
      b.pick,
      b."probEstimated"::float AS prob,
      b."oddsSnapshot"::float AS odds,
      b.status,
      b."fixtureId" AS "fixtureId",
      f."scheduledAt" AS "scheduledAt",
      (mr.features->>'calibration_alert' IS NOT NULL) AS "calibAlert",
      (mr.features->'offensiveBalance'->>'classification') AS "offensiveBalance",
      (mr.features->'shadow_predictions'->>'conflict')::boolean AS "shadowConflict",
      (
        SELECT count(DISTINCT mr2.id)
        FROM model_run mr2
        WHERE mr2."fixtureId" = f.id
          AND mr2."analyzedAt" < mr."analyzedAt"
          AND (
            EXISTS (
              SELECT 1 FROM bet b2
              WHERE b2."modelRunId" = mr2.id
                AND b2.market = b.market AND b2.pick = b.pick
            )
            OR EXISTS (
              SELECT 1 FROM channel_selection cs2
              JOIN channel_decision cd2 ON cd2.id = cs2."channelDecisionId"
              WHERE cd2."modelRunId" = mr2.id
                AND cs2.market = b.market AND cs2.pick = b.pick
            )
          )
      ) AS "priorAnalysisCount"
    FROM bet b
    JOIN model_run mr ON mr.id = b."modelRunId"
    JOIN fixture f ON f.id = b."fixtureId"
    WHERE b.source = 'MODEL'
      AND b.status IN ('WON', 'LOST')
      AND b."oddsSnapshot" IS NOT NULL
  `;

  return rows.map((r) => ({
    id: r.id,
    market: r.market,
    pick: r.pick,
    prob: toNum(r.prob),
    odds: toNum(r.odds),
    won: r.status === "WON",
    fixtureId: r.fixtureId,
    scheduledAt: r.scheduledAt,
    calibAlert: r.calibAlert,
    offensiveBalance:
      r.offensiveBalance === "BALANCED" ||
      r.offensiveBalance === "ASYMMETRIC" ||
      r.offensiveBalance === "STRONGLY_ASYMMETRIC"
        ? r.offensiveBalance
        : null,
    shadowConflict: r.shadowConflict,
    priorAnalysisCount: Number(r.priorAnalysisCount),
  }));
}

// Latest odds_snapshot row for (fixtureId, market, pick) at or before cutoff —
// one query per row (FADE candidates are a small subset), matches the
// selection logic in signal-window.service.ts's per-leg odds lookup closely
// enough for a backtest (no bookmaker-preference tie-break needed here since
// we just want "was there a tradeable opposite price").
async function findOppositeOdds(
  fixtureId: string,
  market: string,
  pick: string,
  cutoff: Date,
): Promise<number | null> {
  const row = await prisma.oddsSnapshot.findFirst({
    where: {
      fixtureId,
      market: market as never,
      pick,
      snapshotAt: { lte: cutoff },
      odds: { not: null },
    },
    select: { odds: true },
    orderBy: { snapshotAt: "desc" },
  });
  return row?.odds ? toNum(row.odds) : null;
}

function splitByDay(rows: BaseRow[]): {
  train: BaseRow[];
  valid: BaseRow[];
  splitKey: string;
} {
  const dayKeys = Array.from(
    new Set(rows.map((r) => r.scheduledAt.toISOString().slice(0, 10))),
  ).sort();
  const splitIndex = Math.floor(dayKeys.length * TRAIN_SPLIT);
  const splitKey = dayKeys[splitIndex] ?? "9999-12-31";
  const train = rows.filter(
    (r) => r.scheduledAt.toISOString().slice(0, 10) < splitKey,
  );
  const valid = rows.filter(
    (r) => r.scheduledAt.toISOString().slice(0, 10) >= splitKey,
  );
  return { train, valid, splitKey };
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-coupon-quality-signals-${dateLabel}.txt`,
  );
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };

  out("═══════════════════════════════════════════════════════");
  out("  EVCore — Signaux de qualité leg (coupon), Bet réglés source=MODEL");
  out(`  ${dateLabel} — seuil min-sample par groupe : n>=${MIN_SAMPLE}`);
  out("═══════════════════════════════════════════════════════");

  const allRows = await fetchBaseRows();
  const { train, valid, splitKey } = splitByDay(allRows);
  out();
  out(
    `Paris réglés : ${allRows.length} — split train/valid au ${splitKey} ` +
      `(${Math.round(TRAIN_SPLIT * 100)}/${Math.round((1 - TRAIN_SPLIT) * 100)})`,
  );

  const periods: [Period, BaseRow[]][] = [
    ["overall", allRows],
    ["train", train],
    ["valid", valid],
  ];

  // ── 1. Stabilité dans le temps (priorAnalysisCount) ──────────────────────
  out();
  out("──── 1. Stabilité dans le temps (priorAnalysisCount) ────");
  const buckets: [string, (n: number) => boolean][] = [
    ["0-2 analyses", (n) => n <= 2],
    ["3-5 analyses", (n) => n >= 3 && n <= 5],
    ["6+ analyses", (n) => n >= 6],
  ];
  for (const [label, pred] of buckets) {
    out(`  ${label} :`);
    for (const [period, rows] of periods) {
      const stats = computeStats(
        rows.filter((r) => pred(r.priorAnalysisCount)),
      );
      out(`    ${period.padEnd(7)} : ${formatStats(stats)}`);
    }
  }

  // ── 2. Cohérence interne (shadow_predictions.conflict) ───────────────────
  out();
  out("──── 2. Cohérence interne (shadowConflict) ────");
  for (const val of [false, true]) {
    out(`  conflict=${val} :`);
    for (const [period, rows] of periods) {
      const stats = computeStats(rows.filter((r) => r.shadowConflict === val));
      out(`    ${period.padEnd(7)} : ${formatStats(stats)}`);
    }
  }

  // ── 3. Déséquilibre offensif (offensiveBalance) ──────────────────────────
  out();
  out("──── 3. Déséquilibre offensif (offensiveBalance) ────");
  for (const val of ["BALANCED", "ASYMMETRIC", "STRONGLY_ASYMMETRIC"]) {
    out(`  ${val} :`);
    for (const [period, rows] of periods) {
      const stats = computeStats(
        rows.filter((r) => r.offensiveBalance === val),
      );
      out(`    ${period.padEnd(7)} : ${formatStats(stats)}`);
    }
  }

  // ── 4. Matrice AVOID (extremeDivergence × calibrationAlert) ──────────────
  out();
  out("──── 4. Matrice AVOID (extremeDivergence × calibrationAlert) ────");
  const withDiv = allRows.map((r) => ({
    ...r,
    extremeDiv: isExtremeDivergence(r.prob, r.odds),
  }));
  const matrix: [string, boolean, boolean][] = [
    ["CLEAN (ni divergence ni alerte)", false, false],
    ["FADE (divergence seule)", true, false],
    ["DROP (alerte seule)", false, true],
    ["KEEP (les deux)", true, true],
  ];
  for (const [label, div, calib] of matrix) {
    out(`  ${label} :`);
    for (const [period] of periods) {
      const withDivPeriod =
        period === "overall"
          ? withDiv
          : withDiv.filter((r) =>
              (period === "train" ? train : valid).some((x) => x.id === r.id),
            );
      const bucket = withDivPeriod.filter(
        (r) => r.extremeDiv === div && r.calibAlert === calib,
      );
      out(`    ${period.padEnd(7)} : ${formatStats(computeStats(bucket))}`);
    }
  }

  // ── 4b. FADE — ROI du pick inverse (divergence seule, marchés 2 issues) ──
  out();
  out("──── 4b. FADE — ROI du pick inverse ────");
  const fadeCandidates = withDiv.filter(
    (r) => r.extremeDiv && !r.calibAlert && oppositePick(r.pick) !== null,
  );
  const fadeRows: {
    won: boolean;
    odds: number;
    scheduledAt: Date;
    id: string;
  }[] = [];
  for (const r of fadeCandidates) {
    const opp = oppositePick(r.pick);
    if (!opp) continue;
    const oppOdds = await findOppositeOdds(
      r.fixtureId,
      r.market,
      opp,
      r.scheduledAt,
    );
    if (oppOdds === null) continue;
    fadeRows.push({
      won: !r.won, // the opposite wins exactly when the original lost
      odds: oppOdds,
      scheduledAt: r.scheduledAt,
      id: r.id,
    });
  }
  const fadeTrain = fadeRows.filter(
    (r) => r.scheduledAt.toISOString().slice(0, 10) < splitKey,
  );
  const fadeValid = fadeRows.filter(
    (r) => r.scheduledAt.toISOString().slice(0, 10) >= splitKey,
  );
  out(`  overall : ${formatStats(computeStats(fadeRows))}`);
  out(`  train   : ${formatStats(computeStats(fadeTrain))}`);
  out(`  valid   : ${formatStats(computeStats(fadeValid))}`);
  out(
    `  (${fadeCandidates.length - fadeRows.length}/${fadeCandidates.length} candidats FADE sans cote opposée trouvée en base — exclus)`,
  );

  out();
  out("═══════════════════════════════════════════════════════");
  out(
    "  Verdict : un signal n'est actionnable que si train ET valid dépassent",
  );
  out(
    "  n>=MIN_SAMPLE et vont dans le même sens — sinon rester en observation.",
  );
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
