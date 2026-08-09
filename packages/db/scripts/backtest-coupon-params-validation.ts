/// <reference types="node" />
/**
 * `coupon.constants.ts` cites `apps/backend/reports/backtest-selected-params.json`
 * (2026-05-19, Train ROI +100.3% / Test ROI +61.8% / hit 51.5% / PASS) as the
 * source of `COUPON_PARAMS` — that file doesn't exist in this repo (documented
 * gap, `docs/formation-content-maintenance.md` §5). This script replaces it
 * with a real, rerunnable validation, on ACTUAL settled `CouponProposal` rows
 * (not a resimulation) — every one of these coupons was really generated and
 * really settled under the live pipeline since 2023-04-15.
 *
 * IMPORTANT — survivorship bias, read before touching any threshold: every
 * row here already cleared the CURRENT `minCouponEV`/`maxCombinedOdds`
 * (whatever they were at generation time). This can only tell you whether
 * TIGHTENING those floors further would have helped — it cannot tell you
 * what would have happened had they been LOWER, because those proposals were
 * never generated in the first place. Don't read a threshold below today's
 * live value as validated by this report.
 *
 * Also out of scope here: `k`/`capMin`/`capMax`/`decayHalfLifeDays`/
 * `windowDays`/`nLeagueMin` feed the calibration math in
 * `SignalWindowService.computeSignalWindow` (canal/dow/league hit-rate
 * blending) — re-deriving those would mean resimulating that calibration
 * historically, which this script does not do. What IS covered: whether the
 * live params as a whole produce positive ROI train/valid, and whether
 * raising `minCouponEV` or lowering `maxCombinedOdds` further would help.
 *
 * Run: pnpm --filter @evcore/db db:backtest:coupon-params-validation
 * Output: packages/db/reports/backtest-coupon-params-validation-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { CouponResult } from "../src/generated/prisma/client";
import { prisma } from "../src/client";

const TRAIN_SPLIT = 0.6;
const MIN_SPLIT_SAMPLE = 20;
const EV_THRESHOLDS = [0.05, 0.08, 0.1, 0.15, 0.2, 0.3];
const ODDS_CEILINGS = [3, 4, 5, 6, 8, 10, Number.POSITIVE_INFINITY];

type Row = {
  dayKey: string;
  combinedOdds: number;
  couponEV: number | null;
  result: CouponResult;
};

type Stats = { n: number; won: number; roiPct: number; hitPct: number };

function toNum(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}

// PARTIAL settlement exists in the schema but wasn't observed in this data
// set — treated as a push (0 P&L) rather than a full win/loss, the
// conservative choice when we don't have the partial payout ratio on hand.
function pnlOf(r: Row): number {
  if (r.result === CouponResult.WON) return r.combinedOdds - 1;
  if (r.result === CouponResult.LOST) return -1;
  return 0;
}

function computeStats(rows: Row[]): Stats {
  const n = rows.length;
  const won = rows.filter((r) => r.result === CouponResult.WON).length;
  const pnl = rows.reduce((sum, r) => sum + pnlOf(r), 0);
  return {
    n,
    won,
    roiPct: n > 0 ? (pnl / n) * 100 : 0,
    hitPct: n > 0 ? (won / n) * 100 : 0,
  };
}

function formatStats(s: Stats): string {
  if (s.n === 0) return "n=0";
  const flag = s.n < MIN_SPLIT_SAMPLE ? " (n<seuil, non concluant)" : "";
  return `n=${s.n}, hit=${s.hitPct.toFixed(1)}%, ROI=${s.roiPct.toFixed(2)}%${flag}`;
}

async function fetchRows(): Promise<Row[]> {
  const proposals = await prisma.couponProposal.findMany({
    where: { result: { not: null } },
    select: {
      forDate: true,
      combinedOdds: true,
      result: true,
      reasoning: true,
    },
  });

  return proposals.map((p) => {
    const reasoning = p.reasoning as Record<string, unknown> | null;
    const rawEV = reasoning?.["couponEV"];
    return {
      dayKey: p.forDate.toISOString().slice(0, 10),
      combinedOdds: toNum(p.combinedOdds),
      couponEV: typeof rawEV === "number" ? rawEV : null,
      result: p.result!,
    };
  });
}

function splitByDay(rows: Row[]): { train: Row[]; valid: Row[]; splitKey: string } {
  const dayKeys = Array.from(new Set(rows.map((r) => r.dayKey))).sort();
  const splitIndex = Math.floor(dayKeys.length * TRAIN_SPLIT);
  const splitKey = dayKeys[splitIndex] ?? "9999-12-31";
  return {
    train: rows.filter((r) => r.dayKey < splitKey),
    valid: rows.filter((r) => r.dayKey >= splitKey),
    splitKey,
  };
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-coupon-params-validation-${dateLabel}.txt`,
  );
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };

  out("═══════════════════════════════════════════════════════");
  out("  EVCore — Validation COUPON_PARAMS sur CouponProposal réel réglé");
  out(`  ${dateLabel} — seuil min-échantillon par bucket : n>=${MIN_SPLIT_SAMPLE}`);
  out("  ⚠ Biais de survie : ne teste que le RESSERREMENT des seuils actuels,");
  out("  pas leur relâchement (cf. commentaire en tête du script).");
  out("═══════════════════════════════════════════════════════");

  const allRows = await fetchRows();
  const { train, valid, splitKey } = splitByDay(allRows);

  out();
  out(
    `Coupons réglés : ${allRows.length} (depuis ${allRows.map((r) => r.dayKey).sort()[0]}) ` +
      `— split au ${splitKey} (${Math.round(TRAIN_SPLIT * 100)}/${Math.round((1 - TRAIN_SPLIT) * 100)})`,
  );

  out();
  out("──── 1. Validation globale — les paramètres LIVE actuels ────");
  out(`  overall : ${formatStats(computeStats(allRows))}`);
  out(`  train   : ${formatStats(computeStats(train))}`);
  out(`  valid   : ${formatStats(computeStats(valid))}`);

  out();
  out("──── 2. Resserrement de minCouponEV (couponEV enregistré) ────");
  const withEV = allRows.filter((r) => r.couponEV !== null);
  out(`  (${allRows.length - withEV.length}/${allRows.length} coupons sans couponEV enregistré — exclus de cette section)`);
  for (const threshold of EV_THRESHOLDS) {
    const subsetAll = withEV.filter((r) => r.couponEV! >= threshold);
    const subsetTrain = train.filter((r) => r.couponEV !== null && r.couponEV >= threshold);
    const subsetValid = valid.filter((r) => r.couponEV !== null && r.couponEV >= threshold);
    out(`  minCouponEV >= ${threshold.toFixed(2)} :`);
    out(`    overall : ${formatStats(computeStats(subsetAll))}`);
    out(`    train   : ${formatStats(computeStats(subsetTrain))}`);
    out(`    valid   : ${formatStats(computeStats(subsetValid))}`);
  }

  out();
  out("──── 3. Resserrement de maxCombinedOdds ────");
  for (const ceiling of ODDS_CEILINGS) {
    const label = Number.isFinite(ceiling) ? ceiling.toFixed(1) : "∞ (actuel)";
    const subsetAll = allRows.filter((r) => r.combinedOdds <= ceiling);
    const subsetTrain = train.filter((r) => r.combinedOdds <= ceiling);
    const subsetValid = valid.filter((r) => r.combinedOdds <= ceiling);
    out(`  maxCombinedOdds <= ${label} :`);
    out(`    overall : ${formatStats(computeStats(subsetAll))}`);
    out(`    train   : ${formatStats(computeStats(subsetTrain))}`);
    out(`    valid   : ${formatStats(computeStats(subsetValid))}`);
  }

  out();
  out("═══════════════════════════════════════════════════════");
  out("  Verdict : un resserrement n'est actionnable que si train ET valid");
  out("  dépassent n>=MIN_SPLIT_SAMPLE et améliorent le ROI dans les deux —");
  out("  sinon les paramètres LIVE actuels restent la meilleure option connue.");
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
