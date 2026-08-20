/// <reference types="node" />
/**
 * Calibration walk-forward d'un shrink-vers-0.5 pour la probabilité des
 * jambes VALUE dans les coupons — distinct de VALUE_MARKET_TRUST_MAP
 * (ev.constants.ts), qui ne discounte que le `qualityScore` de classement
 * pour le STAKING (validé +0.86pp ROI, backtest-market-trust-calibration).
 * `coupon-composer.service.ts`'s `calibrateLegProbability` est un chemin de
 * code séparé qui alimente `jointProbability` — ce discount de rang n'y a
 * jamais été appliqué.
 *
 * Contexte (2026-08-19) : ventilation par (canal, marché) sur le backtest
 * complet 2025-08-01→2026-08-19 montre VALUE structurellement le plus
 * surconfiant, quel que soit le marché — ex. FIRST_HALF_WINNER prédit 43%
 * réel 0% (n=10), TEAM_TOTAL_HOME prédit 55% réel 12% (n=16), ONE_X_TWO
 * prédit 67% réel 43% (n=106, échantillon solide). Cohérent avec le biais
 * "winner's curse" déjà diagnostiqué cette session : la sélection par edge/EV
 * de VALUE choisit disproportionnellement les jambes dont l'edge apparent
 * vient du bruit de calibration, pas d'un vrai avantage.
 *
 * Un seul facteur global (pas par marché) : le volume par marché est trop
 * mince pour un fit séparé (la plupart <30 lignes), sauf ONE_X_TWO/BTTS —
 * un pool global reste la seule option raisonnable pour ce premier passage.
 *
 * p' = 0.5 + factor × (p − 0.5) — shrink vers le coin-flip, pas vers un taux
 * empirique global (chaque jambe est un pari individuel, contrairement à
 * jointProbability qui a un taux de victoire de coupon bien défini).
 *
 * Run: pnpm --filter @evcore/db db:backtest:coupon-value-leg-shrinkage-calibration
 * Output: packages/db/reports/backtest-coupon-value-leg-shrinkage-calibration-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/client";

const MIN_TRAIN_VOLUME = 100;
const MIN_TEST_VOLUME = 30;
const MIN_BRIER_IMPROVEMENT = 0.001;
const FACTOR_GRID_STEP = 0.05;

type ValueLeg = {
  forDate: Date;
  market: string;
  probability: number;
  won: boolean;
};

function brier(rows: ValueLeg[], predict: (raw: number) => number): number {
  const sumSq = rows.reduce((acc, r) => {
    const p = predict(r.probability);
    const outcome = r.won ? 1 : 0;
    return acc + (p - outcome) ** 2;
  }, 0);
  return sumSq / rows.length;
}

function shrink(raw: number, factor: number): number {
  return 0.5 + factor * (raw - 0.5);
}

async function main(): Promise<void> {
  const legs = await prisma.couponProposalLeg.findMany({
    where: {
      canal: "VALUE",
      isCorrect: { not: null },
      couponProposal: {
        forDate: {
          gte: new Date("2025-08-01T00:00:00.000Z"),
          lte: new Date("2026-08-19T23:59:59.999Z"),
        },
      },
    },
    select: {
      market: true,
      probability: true,
      isCorrect: true,
      couponProposal: { select: { forDate: true } },
    },
    orderBy: { couponProposal: { forDate: "asc" } },
  });

  const rows: ValueLeg[] = legs.map((l) => ({
    forDate: l.couponProposal.forDate,
    market: l.market,
    probability: Number(l.probability),
    won: l.isCorrect === true,
  }));

  const splitIdx = Math.floor(rows.length * 0.75);
  const train = rows.slice(0, splitIdx);
  const test = rows.slice(splitIdx);

  const lines: string[] = [];
  const log = (line: string): void => {
    lines.push(line);
    console.log(line);
  };

  log(`Coupon VALUE-leg shrinkage calibration — ${new Date().toISOString()}`);
  log(`Total VALUE legs: ${rows.length} (train=${train.length}, test=${test.length})`);

  if (train.length < MIN_TRAIN_VOLUME || test.length < MIN_TEST_VOLUME) {
    log(
      `Insufficient volume (need train>=${MIN_TRAIN_VOLUME}, test>=${MIN_TEST_VOLUME}) — aborting.`,
    );
    await writeReport(lines);
    return;
  }

  const rawTrainBrier = brier(train, (p) => p);
  log(`train Brier — raw (no shrink) = ${rawTrainBrier.toFixed(4)}`);

  let bestFactor = 1.0;
  let bestTrainBrier = rawTrainBrier;
  for (let factor = 0; factor <= 1.0001; factor += FACTOR_GRID_STEP) {
    const b = brier(train, (p) => shrink(p, factor));
    if (b < bestTrainBrier) {
      bestTrainBrier = b;
      bestFactor = factor;
    }
  }
  log(
    `best factor on train = ${bestFactor.toFixed(2)} (train Brier ${bestTrainBrier.toFixed(4)} vs raw ${rawTrainBrier.toFixed(4)})`,
  );

  const rawTestBrier = brier(test, (p) => p);
  const shrunkTestBrier = brier(test, (p) => shrink(p, bestFactor));
  const improvement = rawTestBrier - shrunkTestBrier;
  log(`test Brier — raw = ${rawTestBrier.toFixed(4)}, shrunk = ${shrunkTestBrier.toFixed(4)}`);
  log(`test Brier improvement = ${improvement.toFixed(4)} (need >= ${MIN_BRIER_IMPROVEMENT})`);

  log("");
  log("Per-market breakdown on test (raw vs shrunk, informational only — n too thin to fit per-market):");
  const byMarket = new Map<string, { n: number; won: number; sumRaw: number; sumShrunk: number }>();
  for (const r of test) {
    const entry = byMarket.get(r.market) ?? { n: 0, won: 0, sumRaw: 0, sumShrunk: 0 };
    entry.n += 1;
    entry.won += r.won ? 1 : 0;
    entry.sumRaw += r.probability;
    entry.sumShrunk += shrink(r.probability, bestFactor);
    byMarket.set(r.market, entry);
  }
  for (const [market, e] of [...byMarket.entries()].sort((a, b) => b[1].n - a[1].n)) {
    log(
      `  ${market}: n=${e.n} actual=${(e.won / e.n).toFixed(3)} raw=${(e.sumRaw / e.n).toFixed(3)} shrunk=${(e.sumShrunk / e.n).toFixed(3)}`,
    );
  }

  log("");
  if (improvement >= MIN_BRIER_IMPROVEMENT && bestFactor < 1.0) {
    log(`SHIP: VALUE leg probability shrink factor = ${bestFactor.toFixed(2)} (p' = 0.5 + factor × (p − 0.5))`);
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
    `backtest-coupon-value-leg-shrinkage-calibration-${date}.txt`,
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
