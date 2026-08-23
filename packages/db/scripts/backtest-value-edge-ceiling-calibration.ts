/// <reference types="node" />
/**
 * Calibration walk-forward d'un plafond d'edge pour VALUE (ONE_X_TWO/OVER_
 * UNDER/BTTS/… — tous les marchés de ValueStrategy.ALL_MARKETS).
 *
 * Contexte (2026-08-19) : l'audit du replay complet (reanalyze-scope,
 * seasons 2024-25/2025/2025-26/2026/2026-27) montre que la proba Poisson
 * BRUTE est raisonnablement calibrée (DOMINANT lui-même : 64.5% annoncé vs
 * 58.2% réel, gap -6.3pp, n=6708) mais que la sélection VALUE (meilleur
 * edge = probabilité − 1/cote, parmi TOUS les marchés candidats d'un match)
 * dégrade fortement ce chiffre par tranche d'edge apparent :
 *   edge~0.21 → 71.4% annoncé / 56.6% réel
 *   edge~0.60 → 64.9% annoncé / 39.8% réel
 *   edge~2.32 → 62.7% annoncé / 25.0% réel
 * C'est le winner's curse classique : maximiser sur N candidats bruités
 * biaise vers les cas où le modèle a le plus tort, pas vers la vraie
 * opportunité — déjà connu du projet (AVOID_CONFIG.maxEdge=0.3, validé à
 * -20% ROI au-delà, mais ça ne protège que les coupons, jamais la vraie
 * ligne `bet` de VALUE ; SAFE a EV_HARD_CAP=0.90, VALUE n'a aucun plafond).
 *
 * Ce script ne rejoue PAS le pipeline depuis les TeamStats point-in-time
 * (contrairement aux scripts de shrinkage BTTS/GOALS/TEAM_TOTAL) : il lit
 * les `channel_selection` Phase 1 (DOMINANT/BTTS/GOALS/TEAM_TOTAL/CLEAN_
 * SHEET/WIN_EITHER_HALF/FIRST_HALF/DOUBLE_CHANCE/DRAW_NO_BET/WIN_TO_NIL/
 * HALF_TIME_FULL_TIME/RESULT_TOTAL_GOALS/RESULT_BTTS) produites par le
 * replay complet du 2026-08-19 — c'est-à-dire la sortie du pipeline ACTUEL
 * (toutes les recalibrations GOALS/TEAM_TOTAL/BTTS/1X2-blend/congestion de
 * cette session incluses), pas un historique périmé (cf. mémoire
 * feedback_backtest_definition). Reproduire les 13 spécialistes Phase 1
 * depuis zéro ici serait un doublon fragile de leur config par ligue ; les
 * relire depuis un replay tout juste régénéré sous le code courant est
 * exactement ce que ce garde-fou vise à éviter de faire avec du VIEUX code.
 * ⚠️ Si ce script est relancé plus tard sans nouveau replay complet, les
 * données seront celles du dernier replay, pas du code courant — le script
 * avertit si le plus récent model_run date de plus de 24h.
 *
 * Simule, pour chaque plafond de la grille, quel candidat VALUE aurait
 * sélectionné (edge ∈ [VALUE_MIN_EDGE, plafond], meilleur qualityScore),
 * puis mesure hit-rate/ROI/Brier — walk-forward chronologique (train = 75%
 * les plus anciens, test = 25% les plus récents), ne retient un plafond que
 * s'il améliore le ROI sur le train ET se confirme hors échantillon sur le
 * test (même principe que les calibrations shrinkage : deux temps, jamais
 * un seul chiffre in-sample).
 *
 * Run: pnpm --filter @evcore/db db:backtest:value-edge-ceiling-calibration
 * Output: packages/db/reports/backtest-value-edge-ceiling-calibration-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/client";
import { Market } from "../src/generated/prisma/client";

const VALUE_MIN_EDGE = 0.1;
const CEILING_GRID = [
  0.15,
  0.2,
  0.25,
  0.3,
  0.35,
  0.4,
  0.5,
  0.6,
  0.75,
  0.9,
  Infinity,
];
const MIN_TRAIN_VOLUME = 50;
const MIN_TEST_VOLUME = 20;
const MIN_ROI_IMPROVEMENT = 0.02; // 2pp — le bruit ROI sur ces volumes est important
const STALE_WARNING_HOURS = 24;

// Miroir de ValueStrategy.ALL_MARKETS (value.strategy.ts) — tenu à jour
// manuellement, les deux listes doivent rester identiques.
const VALUE_MARKETS: Market[] = [
  Market.ONE_X_TWO,
  Market.OVER_UNDER,
  Market.BTTS,
  Market.DOUBLE_CHANCE,
  Market.HALF_TIME_FULL_TIME,
  Market.OVER_UNDER_HT,
  Market.FIRST_HALF_WINNER,
  Market.DRAW_NO_BET,
  Market.TEAM_TOTAL_HOME,
  Market.TEAM_TOTAL_AWAY,
  Market.CLEAN_SHEET_HOME,
  Market.CLEAN_SHEET_AWAY,
  Market.WIN_TO_NIL_HOME,
  Market.WIN_TO_NIL_AWAY,
  Market.TO_WIN_EITHER_HALF,
  Market.RESULT_TOTAL_GOALS,
  Market.RESULT_BTTS,
];

const PHASE1_CHANNELS_EXCLUDED = new Set([
  "VALUE",
  "SAFE",
  "CONSENSUS",
  "CONTRARIAN",
  "AVOID",
]);

type Candidate = {
  market: Market;
  pick: string;
  probability: number;
  odds: number;
  qualityScore: number;
  edge: number;
  won: boolean;
};

type Fixture = {
  modelRunId: string;
  scheduledAt: Date;
  candidates: Candidate[];
};

function edgeOf(probability: number, odds: number): number {
  return probability - 1 / odds;
}

function pickUnderCeiling(
  candidates: Candidate[],
  ceiling: number,
): Candidate | null {
  const eligible = candidates.filter(
    (c) => c.edge >= VALUE_MIN_EDGE && c.edge <= ceiling,
  );
  if (eligible.length === 0) return null;
  return eligible.reduce((best, c) =>
    c.qualityScore > best.qualityScore ? c : best,
  );
}

type Metrics = { n: number; hitRate: number; roi: number; brier: number };

function computeMetrics(fixtures: Fixture[], ceiling: number): Metrics {
  const picks = fixtures
    .map((f) => pickUnderCeiling(f.candidates, ceiling))
    .filter((p): p is Candidate => p !== null);
  const n = picks.length;
  if (n === 0) return { n: 0, hitRate: 0, roi: 0, brier: 0 };
  const wins = picks.filter((p) => p.won).length;
  const roi = picks.reduce((sum, p) => sum + (p.won ? p.odds - 1 : -1), 0) / n;
  const brier =
    picks.reduce((sum, p) => {
      const outcome = p.won ? 1 : 0;
      return sum + (p.probability - outcome) ** 2;
    }, 0) / n;
  return { n, hitRate: wins / n, roi, brier };
}

async function main(): Promise<void> {
  const mostRecentRun = await prisma.modelRun.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const ageHours = mostRecentRun
    ? (Date.now() - mostRecentRun.createdAt.getTime()) / 36e5
    : Infinity;
  const staleWarning =
    ageHours > STALE_WARNING_HOURS
      ? `\n⚠️ Le model_run le plus récent date de ${ageHours.toFixed(1)}h — ` +
        `ces channel_selection Phase 1 peuvent ne plus refléter le code ` +
        `courant. Relancer reanalyze-scope.ts avant de faire confiance à ce ` +
        `rapport.\n`
      : "";

  const rows = await prisma.channelSelection.findMany({
    where: {
      market: { in: VALUE_MARKETS },
      result: { in: ["WON", "LOST"] },
      odds: { not: null },
      channelDecision: {
        channel: { notIn: Array.from(PHASE1_CHANNELS_EXCLUDED) },
      },
    },
    select: {
      market: true,
      pick: true,
      probability: true,
      odds: true,
      qualityScore: true,
      result: true,
      channelDecision: {
        select: {
          modelRunId: true,
          modelRun: { select: { fixture: { select: { scheduledAt: true } } } },
        },
      },
    },
  });

  console.log(`Candidats Phase 1 chargés : ${rows.length}`);

  const byFixture = new Map<string, Fixture>();
  for (const row of rows) {
    const modelRunId = row.channelDecision.modelRunId;
    const scheduledAt = row.channelDecision.modelRun.fixture.scheduledAt;
    const probability = Number(row.probability);
    const odds = Number(row.odds);
    const qualityScore =
      row.qualityScore !== null ? Number(row.qualityScore) : 0;
    const candidate: Candidate = {
      market: row.market,
      pick: row.pick,
      probability,
      odds,
      qualityScore,
      edge: edgeOf(probability, odds),
      won: row.result === "WON",
    };
    const existing = byFixture.get(modelRunId);
    if (existing) existing.candidates.push(candidate);
    else
      byFixture.set(modelRunId, {
        modelRunId,
        scheduledAt,
        candidates: [candidate],
      });
  }

  const fixtures = Array.from(byFixture.values()).sort(
    (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime(),
  );
  console.log(
    `Fixtures distinctes avec ≥1 candidat VALUE-éligible : ${fixtures.length}`,
  );

  const splitIndex = Math.floor(fixtures.length * 0.75);
  const train = fixtures.slice(0, splitIndex);
  const test = fixtures.slice(splitIndex);

  const lines: string[] = [];
  lines.push("# Calibration plafond d'edge VALUE — walk-forward chronologique");
  lines.push(staleWarning);
  lines.push(
    `Train: ${train.length} fixtures (${train[0]?.scheduledAt.toISOString().slice(0, 10)} → ${train.at(-1)?.scheduledAt.toISOString().slice(0, 10)})`,
  );
  lines.push(
    `Test:  ${test.length} fixtures (${test[0]?.scheduledAt.toISOString().slice(0, 10)} → ${test.at(-1)?.scheduledAt.toISOString().slice(0, 10)})`,
  );
  lines.push("");
  lines.push("## Grid search (TRAIN)");
  lines.push("ceiling\tn\thitRate\troi\tbrier");

  let bestCeiling: number | null = null;
  let bestTrainRoi = -Infinity;
  const noCapTrain = computeMetrics(train, Infinity);
  for (const ceiling of CEILING_GRID) {
    const m = computeMetrics(train, ceiling);
    lines.push(
      `${ceiling === Infinity ? "none" : ceiling}\t${m.n}\t${(m.hitRate * 100).toFixed(1)}%\t${(m.roi * 100).toFixed(2)}%\t${m.brier.toFixed(4)}`,
    );
    if (
      ceiling !== Infinity &&
      m.n >= MIN_TRAIN_VOLUME &&
      m.roi > bestTrainRoi &&
      m.roi - noCapTrain.roi >= MIN_ROI_IMPROVEMENT
    ) {
      bestTrainRoi = m.roi;
      bestCeiling = ceiling;
    }
  }

  lines.push("");
  lines.push(
    `Baseline (pas de plafond) TRAIN: n=${noCapTrain.n} roi=${(noCapTrain.roi * 100).toFixed(2)}%`,
  );

  if (bestCeiling === null) {
    lines.push("");
    lines.push(
      "❌ Aucun plafond ne bat la baseline TRAIN d'au moins " +
        `${MIN_ROI_IMPROVEMENT * 100}pp avec n≥${MIN_TRAIN_VOLUME} — pas de plafond à valider.`,
    );
  } else {
    const testCapped = computeMetrics(test, bestCeiling);
    const testBaseline = computeMetrics(test, Infinity);
    lines.push("");
    lines.push(
      `## Validation hors échantillon (TEST) — plafond retenu: ${bestCeiling}`,
    );
    lines.push(
      `Avec plafond : n=${testCapped.n} hitRate=${(testCapped.hitRate * 100).toFixed(1)}% roi=${(testCapped.roi * 100).toFixed(2)}% brier=${testCapped.brier.toFixed(4)}`,
    );
    lines.push(
      `Sans plafond : n=${testBaseline.n} hitRate=${(testBaseline.hitRate * 100).toFixed(1)}% roi=${(testBaseline.roi * 100).toFixed(2)}% brier=${testBaseline.brier.toFixed(4)}`,
    );
    lines.push("");
    if (testCapped.n >= MIN_TEST_VOLUME && testCapped.roi > testBaseline.roi) {
      lines.push(
        `✅ Le plafond ${bestCeiling} généralise : ROI test ${(testCapped.roi * 100).toFixed(2)}% > baseline ${(testBaseline.roi * 100).toFixed(2)}% (n=${testCapped.n}).`,
      );
    } else {
      lines.push(
        `❌ Le plafond ${bestCeiling} ne généralise PAS (ROI test ${(testCapped.roi * 100).toFixed(2)}% vs baseline ${(testBaseline.roi * 100).toFixed(2)}%, n=${testCapped.n}) — ne pas livrer, le gain train était probablement du bruit.`,
      );
    }
  }

  const report = lines.join("\n");
  console.log(`\n${report}`);

  const dir = join(__dirname, "..", "reports");
  mkdirSync(dir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const path = join(dir, `backtest-value-edge-ceiling-calibration-${date}.txt`);
  writeFileSync(path, report);
  console.log(`\nRapport écrit: ${path}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
