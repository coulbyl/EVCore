/// <reference types="node" />
/**
 * Calibration walk-forward de `jointProbability` (coupon.constants.ts's
 * JOINT_PROBABILITY_CORRELATION_FACTOR) — actuellement neutralisé
 * (factor=1.0, no-op) depuis l'audit 2026-08-12, en attente de "la
 * calibration par bucket" annoncée dans le commentaire du code.
 *
 * Contexte (2026-08-19) : un backtest complet 2025-08-01→2026-08-19
 * (régénération + settlement forcé via regenerate-coupons.ts) montre un
 * gap systématique et croissant entre jointProbability annoncée et le taux
 * de victoire réel — ex. proba annoncée 44% → réel 21% sur le profil
 * DEFAULT, 63% → 44% sur SAFE. Le gap grandit avec la probabilité annoncée,
 * signature typique d'une surconfiance par jambe qui se compose
 * multiplicativement dans le produit brut des probas.
 *
 * Réutilise le protocole shrink-to-prior déjà établi (ou-shrinkage.ts) :
 * p' = base + factor × (p − base), factor ∈ [0,1] (1 = identity, 0 = shrink
 * complet vers `base`). `base` = taux de victoire empirique global (train) ;
 * `factor` choisi par grid-search minimisant le Brier score (pas de critère
 * ROI : les coupons LONGSHOT n'ont quasiment pas d'historique réglé, et le
 * signal qu'on corrige ici est la calibration elle-même, pas l'edge).
 *
 * Split walk-forward chronologique sur `forDate` (75% train le plus ancien,
 * 25% test le plus récent) — pool TOUS les profils ensemble (SAFE/DEFAULT/
 * LONGSHOT) : jointProbability est une correction de probabilité, pas un
 * paramètre par profil, et SAFE seul (60 lignes) est trop mince pour un fit
 * séparé.
 *
 * Run: pnpm --filter @evcore/db db:backtest:coupon-joint-probability-shrinkage-calibration
 * Output: packages/db/reports/backtest-coupon-joint-probability-shrinkage-calibration-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/client";

const MIN_TRAIN_VOLUME = 100;
const MIN_TEST_VOLUME = 30;
const MIN_BRIER_IMPROVEMENT = 0.001;
const FACTOR_GRID_STEP = 0.05;
const CAP_MIN = 0.01;
const CAP_MAX = 0.8;

type SettledCoupon = {
  forDate: Date;
  jointProbability: number;
  won: boolean;
};

function brier(rows: SettledCoupon[], predict: (raw: number) => number): number {
  const sumSq = rows.reduce((acc, r) => {
    const p = predict(r.jointProbability);
    const outcome = r.won ? 1 : 0;
    return acc + (p - outcome) ** 2;
  }, 0);
  return sumSq / rows.length;
}

function shrink(raw: number, base: number, factor: number): number {
  const shrunk = base + factor * (raw - base);
  return Math.min(CAP_MAX, Math.max(CAP_MIN, shrunk));
}

async function main(): Promise<void> {
  const proposals = await prisma.couponProposal.findMany({
    where: {
      forDate: {
        gte: new Date("2025-08-01T00:00:00.000Z"),
        lte: new Date("2026-08-19T23:59:59.999Z"),
      },
      result: { in: ["WON", "LOST"] },
    },
    select: { forDate: true, jointProbability: true, result: true },
    orderBy: { forDate: "asc" },
  });

  const rows: SettledCoupon[] = proposals.map((p) => ({
    forDate: p.forDate,
    jointProbability: Number(p.jointProbability),
    won: p.result === "WON",
  }));

  const splitIdx = Math.floor(rows.length * 0.75);
  const train = rows.slice(0, splitIdx);
  const test = rows.slice(splitIdx);

  const lines: string[] = [];
  const log = (line: string): void => {
    lines.push(line);
    console.log(line);
  };

  log(`Coupon jointProbability shrinkage calibration — ${new Date().toISOString()}`);
  log(`Total settled coupons: ${rows.length} (train=${train.length}, test=${test.length})`);

  if (train.length < MIN_TRAIN_VOLUME || test.length < MIN_TEST_VOLUME) {
    log(
      `Insufficient volume (need train>=${MIN_TRAIN_VOLUME}, test>=${MIN_TEST_VOLUME}) — aborting.`,
    );
    await writeReport(lines);
    return;
  }

  const base = train.filter((r) => r.won).length / train.length;
  log(`base (empirical win rate, train) = ${base.toFixed(4)}`);

  const rawTrainBrier = brier(train, (p) => p);
  log(`train Brier — raw (no shrink) = ${rawTrainBrier.toFixed(4)}`);

  let bestFactor = 1.0;
  let bestTrainBrier = rawTrainBrier;
  for (let factor = 0; factor <= 1.0001; factor += FACTOR_GRID_STEP) {
    const b = brier(train, (p) => shrink(p, base, factor));
    if (b < bestTrainBrier) {
      bestTrainBrier = b;
      bestFactor = factor;
    }
  }
  log(
    `best factor on train = ${bestFactor.toFixed(2)} (train Brier ${bestTrainBrier.toFixed(4)} vs raw ${rawTrainBrier.toFixed(4)})`,
  );

  const rawTestBrier = brier(test, (p) => p);
  const shrunkTestBrier = brier(test, (p) => shrink(p, base, bestFactor));
  const improvement = rawTestBrier - shrunkTestBrier;
  log(`test Brier — raw = ${rawTestBrier.toFixed(4)}, shrunk = ${shrunkTestBrier.toFixed(4)}`);
  log(`test Brier improvement = ${improvement.toFixed(4)} (need >= ${MIN_BRIER_IMPROVEMENT})`);

  // Reliability check — bucket the SHRUNK probability on test, compare to
  // actual win rate, so a human can see whether the fitted curve actually
  // closes the gap found in the initial audit (not just a lower Brier score).
  log("");
  log("Reliability on test (shrunk vs actual, by decile of shrunk probability):");
  const deciles = new Map<number, { n: number; won: number; sumP: number }>();
  for (const r of test) {
    const shrunkP = shrink(r.jointProbability, base, bestFactor);
    const bucket = Math.min(9, Math.floor(shrunkP * 10));
    const entry = deciles.get(bucket) ?? { n: 0, won: 0, sumP: 0 };
    entry.n += 1;
    entry.won += r.won ? 1 : 0;
    entry.sumP += shrunkP;
    deciles.set(bucket, entry);
  }
  for (const [bucket, entry] of [...deciles.entries()].sort((a, b) => a[0] - b[0])) {
    log(
      `  [${(bucket / 10).toFixed(1)}-${((bucket + 1) / 10).toFixed(1)}) n=${entry.n} predicted=${(entry.sumP / entry.n).toFixed(3)} actual=${(entry.won / entry.n).toFixed(3)}`,
    );
  }

  log("");
  if (improvement >= MIN_BRIER_IMPROVEMENT && bestFactor < 1.0) {
    log(
      `SHIP: JOINT_PROBABILITY_CORRELATION_FACTOR = { base: ${base.toFixed(4)}, factor: ${bestFactor.toFixed(2)}, capMin: ${CAP_MIN}, capMax: ${CAP_MAX} }`,
    );
  } else {
    log("NO SHIP — factor=1 (identity) already best on test, or improvement below threshold.");
  }

  await writeReport(lines);
}

async function writeReport(lines: string[]): Promise<void> {
  const reportsDir = join(__dirname, "..", "reports");
  mkdirSync(reportsDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const path = join(
    reportsDir,
    `backtest-coupon-joint-probability-shrinkage-calibration-${date}.txt`,
  );
  writeFileSync(path, lines.join("\n") + "\n");
  console.log(`\nReport written to ${path}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
