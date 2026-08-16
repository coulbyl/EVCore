/// <reference types="node" />
/**
 * Ré-estime `JOINT_PROBABILITY_CORRELATION_FACTOR` (coupon-composer.service.ts)
 * et re-teste `minJointProbability`/`minCouponEV` sur ACTUELS `CouponProposal`
 * réglés (pas une resimulation) — suite à l'audit 2026-08-12 (bucket ~44%
 * annoncé → 20% réel, n=30) et au diagnostic 2026-08-15 (replay 08-13→08-16 :
 * avec le facteur 20/44, aucune combinaison ne satisfait à la fois
 * minJointProbability=0.25 ET minCouponEV=0.15 — les seuils actuels ont été
 * backtestés sur un jointProbability NON corrigé, donc plus valides tels quels).
 *
 * Méthode : reconstruit le `rawJointProbability` de chaque coupon réglé comme
 * le produit des `calibratedProbability` par jambe (déjà persistées dans
 * `CouponProposalLeg.featureSnapshot` — c'est exactement ce que
 * `legProbability()` utilisait à la génération, AVANT la correction ajoutée le
 * 2026-08-15). Applique ensuite une grille de facteurs candidats, puis pour
 * le meilleur facteur, une grille de `minJointProbability`/`minCouponEV`.
 *
 * ⚠ Biais de survie (même limite que backtest-coupon-params-validation.ts) :
 * chaque ligne a déjà clearé les seuils EN VIGUEUR à la génération (déjà
 * resserrés au fil du temps) — donc ceci ne dit QUE si le nouveau
 * facteur+seuils, appliqués à CE pool déjà filtré, restent viables et
 * rentables. Ne dit rien sur les coupons qui auraient été rejetés à la
 * génération sous ces nouveaux seuils et qui n'existent donc pas ici.
 *
 * ⚠ Autre limite (cf. mémoire feedback_backtest_definition) : `calibratedProbability`
 * par jambe reflète le modèle EN VIGUEUR au moment de la génération de CHAQUE
 * coupon historique, pas le modèle actuel (fixes du PR market-guards inclus)
 * — un vrai rejeu (comme reanalyze-scope.ts) donnerait des jambes différentes.
 * Ce script mesure donc "le facteur aurait-il aidé sur l'historique tel qu'il
 * a été généré", pas "le facteur est-il calibré pour le modèle d'aujourd'hui".
 *
 * Run: pnpm --filter @evcore/db db:backtest:joint-probability-calibration
 * Output: packages/db/reports/backtest-joint-probability-calibration-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { CouponResult } from "../src/generated/prisma/client";
import { prisma } from "../src/client";

const TRAIN_SPLIT = 0.6;
const MIN_SPLIT_SAMPLE = 20;

// Live thresholds today (coupon.constants.ts) — the baseline every candidate
// factor is measured against.
const LIVE_MIN_JOINT_PROBABILITY = 0.25;
const LIVE_MIN_COUPON_EV = 0.15;
const LIVE_MAX_COMBINED_ODDS = 6.0;

const FACTOR_GRID = [1.0, 0.8, 0.7, 0.6, 20 / 44, 0.5, 0.4, 0.3];
const JOINT_PROB_THRESHOLDS = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3];
const EV_THRESHOLDS = [-0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2];

type Row = {
  dayKey: string;
  combinedOdds: number;
  rawJointProbability: number | null;
  result: CouponResult;
};

type Stats = { n: number; won: number; roiPct: number; hitPct: number };

function toNum(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}

// PARTIAL treated as a push (0 P&L) — realizedOdds (2026-08-15 fix) isn't
// backfilled on this historical data, so we don't have the true partial
// payout here either; same conservative choice as coupon-params-validation.ts.
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
      legs: { select: { probability: true, featureSnapshot: true } },
    },
  });

  return proposals.map((p) => {
    let raw = 1;
    let hasAll = true;
    for (const leg of p.legs) {
      const snapshot = leg.featureSnapshot as Record<string, unknown> | null;
      const calibrated = snapshot?.["calibratedProbability"];
      const legProb =
        typeof calibrated === "number" ? calibrated : toNum(leg.probability);
      if (!Number.isFinite(legProb)) {
        hasAll = false;
        break;
      }
      raw *= legProb;
    }
    return {
      dayKey: p.forDate.toISOString().slice(0, 10),
      combinedOdds: toNum(p.combinedOdds),
      rawJointProbability: hasAll ? raw : null,
      result: p.result!,
    };
  });
}

function splitByDay(rows: Row[]): {
  train: Row[];
  valid: Row[];
  splitKey: string;
} {
  const dayKeys = Array.from(new Set(rows.map((r) => r.dayKey))).sort();
  const splitIndex = Math.floor(dayKeys.length * TRAIN_SPLIT);
  const splitKey = dayKeys[splitIndex] ?? "9999-12-31";
  return {
    train: rows.filter((r) => r.dayKey < splitKey),
    valid: rows.filter((r) => r.dayKey >= splitKey),
    splitKey,
  };
}

function applyFactor(
  rows: Row[],
  factor: number,
): { row: Row; jointProbability: number; couponEV: number }[] {
  return rows
    .filter((r) => r.rawJointProbability !== null)
    .map((r) => {
      const jointProbability = (r.rawJointProbability as number) * factor;
      const couponEV = jointProbability * r.combinedOdds - 1;
      return { row: r, jointProbability, couponEV };
    });
}

function statsFor(
  scored: { row: Row; jointProbability: number; couponEV: number }[],
  minJointProbability: number,
  minCouponEV: number,
  maxCombinedOdds: number,
): Stats {
  const kept = scored.filter(
    (s) =>
      s.jointProbability >= minJointProbability &&
      s.couponEV >= minCouponEV &&
      s.row.combinedOdds <= maxCombinedOdds,
  );
  return computeStats(kept.map((s) => s.row));
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-joint-probability-calibration-${dateLabel}.txt`,
  );
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };

  out("═══════════════════════════════════════════════════════");
  out("  EVCore — Recalibration jointProbability sur CouponProposal réel réglé");
  out(`  ${dateLabel} — seuil min-échantillon par bucket : n>=${MIN_SPLIT_SAMPLE}`);
  out("  ⚠ Biais de survie + calibratedProbability figée au moment de chaque");
  out("  génération historique (pas un rejeu du modèle actuel) — voir en-tête.");
  out("═══════════════════════════════════════════════════════");

  const allRows = await fetchRows();
  const withRaw = allRows.filter((r) => r.rawJointProbability !== null);
  const { train, valid, splitKey } = splitByDay(withRaw);

  out();
  out(
    `Coupons réglés : ${allRows.length} (${withRaw.length} avec calibratedProbability reconstructible) ` +
      `— split au ${splitKey} (${Math.round(TRAIN_SPLIT * 100)}/${Math.round((1 - TRAIN_SPLIT) * 100)})`,
  );

  out();
  out(
    `──── 1. Grille de facteurs, seuils LIVE actuels (minJointProbability=${LIVE_MIN_JOINT_PROBABILITY}, minCouponEV=${LIVE_MIN_COUPON_EV}, maxCombinedOdds=${LIVE_MAX_COMBINED_ODDS}) ────`,
  );
  const scoredAllByFactor = new Map<number, ReturnType<typeof applyFactor>>();
  const scoredTrainByFactor = new Map<number, ReturnType<typeof applyFactor>>();
  const scoredValidByFactor = new Map<number, ReturnType<typeof applyFactor>>();
  for (const factor of FACTOR_GRID) {
    const scoredAll = applyFactor(withRaw, factor);
    const scoredTrain = applyFactor(train, factor);
    const scoredValid = applyFactor(valid, factor);
    scoredAllByFactor.set(factor, scoredAll);
    scoredTrainByFactor.set(factor, scoredTrain);
    scoredValidByFactor.set(factor, scoredValid);

    const label = factor === 1.0 ? `${factor.toFixed(3)} (pas de correction)` : factor.toFixed(3);
    out(`  factor = ${label} :`);
    out(
      `    overall : ${formatStats(statsFor(scoredAll, LIVE_MIN_JOINT_PROBABILITY, LIVE_MIN_COUPON_EV, LIVE_MAX_COMBINED_ODDS))}`,
    );
    out(
      `    train   : ${formatStats(statsFor(scoredTrain, LIVE_MIN_JOINT_PROBABILITY, LIVE_MIN_COUPON_EV, LIVE_MAX_COMBINED_ODDS))}`,
    );
    out(
      `    valid   : ${formatStats(statsFor(scoredValid, LIVE_MIN_JOINT_PROBABILITY, LIVE_MIN_COUPON_EV, LIVE_MAX_COMBINED_ODDS))}`,
    );
  }

  out();
  out(
    "──── 2. Grille minJointProbability × minCouponEV (factor = 20/44, le facteur actuel du code) ────",
  );
  const currentFactor = 20 / 44;
  const scoredTrainCur = scoredTrainByFactor.get(currentFactor)!;
  const scoredValidCur = scoredValidByFactor.get(currentFactor)!;
  const scoredAllCur = scoredAllByFactor.get(currentFactor)!;
  for (const jp of JOINT_PROB_THRESHOLDS) {
    for (const ev of EV_THRESHOLDS) {
      const all = statsFor(scoredAllCur, jp, ev, LIVE_MAX_COMBINED_ODDS);
      const trainS = statsFor(scoredTrainCur, jp, ev, LIVE_MAX_COMBINED_ODDS);
      const validS = statsFor(scoredValidCur, jp, ev, LIVE_MAX_COMBINED_ODDS);
      if (trainS.n === 0 && validS.n === 0) continue;
      out(
        `  minJointProbability>=${jp.toFixed(2)}, minCouponEV>=${ev.toFixed(2)} : ` +
          `overall ${formatStats(all)} | train ${formatStats(trainS)} | valid ${formatStats(validS)}`,
      );
    }
  }

  out();
  out("═══════════════════════════════════════════════════════");
  out("  Verdict : un facteur/seuil n'est actionnable que si train ET valid");
  out("  dépassent n>=MIN_SPLIT_SAMPLE et donnent un ROI positif dans les deux.");
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
