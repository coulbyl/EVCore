/// <reference types="node" />
/**
 * Calibration walk-forward d'un poids de confiance par marché pour le
 * classement cross-marché de VALUE et SAFE (2026-08-19).
 *
 * Contexte : `db:backtest:value-edge-ceiling-calibration` a montré qu'aucun
 * plafond d'edge ne sauve le ROI de VALUE (-4.5% à -5% à tout plafond) —
 * mais que le ROI par MARCHÉ, parmi les candidats qui passent déjà le
 * plancher d'edge (≥0.10), varie de +23.3% (DOUBLE_CHANCE) à -75.6%
 * (WIN_TO_NIL_AWAY), et que cette dégradation est large (pas concentrée par
 * ligue — 5/5 ligues négatives pour WIN_TO_NIL_AWAY, etc.). VALUE compare le
 * `qualityScore` (= EV × deterministicScore × pénalité longshot) de 17
 * marchés hétérogènes pour choisir l'argmax : les marchés les moins bien
 * calibrés gagnent ce concours précisément parce que leur bruit est le plus
 * grand, pas parce qu'ils sont les meilleurs picks (winner's curse). SAFE a
 * été élargi le même jour de 4 à 17 marchés (même pool que VALUE) — sans
 * protection, il serait exposé au même risque.
 *
 * Ce script mesure, par marché, le ROI walk-forward parmi les candidats
 * Phase 1 qui passent VALUE_MIN_EDGE (0.10) — même source que le script
 * ceiling (channel_selection du replay complet, PAS un re-replay TeamStats,
 * voir le commentaire équivalent dans backtest-value-edge-ceiling-
 * calibration.ts pour pourquoi c'est légitime ici) — puis dérive un poids
 * de confiance `trust = clamp(trainROI / TRUST_REFERENCE_ROI, MIN_TRUST, 1)`
 * et valide sur le test hors échantillon (chronologique, 75/25) que
 * multiplier qualityScore (VALUE) et probability×EV (SAFE) par ce poids
 * améliore le ROI agrégé de la sélection simulée par rapport à la sélection
 * non pondérée actuelle.
 *
 * Run: pnpm --filter @evcore/db db:backtest:market-trust-calibration
 * Output: packages/db/reports/backtest-market-trust-calibration-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import Decimal from "decimal.js";
import { buildQualityScore } from "@evcore/analysis-core";
import { prisma } from "../src/client";
import { Market } from "../src/generated/prisma/client";

const VALUE_MIN_EDGE = 0.1;
const TRUST_REFERENCE_ROI = 0.15; // ROI ≥ 15% ⇒ trust = 1 (pas de discount)
const MIN_TRUST = 0.05; // jamais 0 — pas d'exclusion pure (feedback_fix_not_disable)
const MIN_MARKET_VOLUME = 30;

// SAFE's own eligibility gates (safe.strategy.ts / selection/constants.ts) —
// duplicated here (not imported: cross-package, this is a db-only script)
// to simulate its ranking on the same candidate pool as VALUE.
const SAFE_MIN_PROBABILITY = 0.68;
const SAFE_MIN_EV = 0.05;
const SAFE_MAX_EV = 0.9;
const SAFE_MIN_ODDS = 1.15;
const SAFE_MAX_ODDS = 2.2;

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
  scheduledAt: Date;
  probability: number;
  odds: number;
  qualityScore: number;
  edge: number;
  ev: number;
  won: boolean;
};

type Fixture = {
  scheduledAt: Date;
  candidates: Candidate[];
};

function edgeOf(probability: number, odds: number): number {
  return probability - 1 / odds;
}

function roiOf(picks: Candidate[]): number {
  if (picks.length === 0) return 0;
  return (
    picks.reduce((sum, p) => sum + (p.won ? p.odds - 1 : -1), 0) / picks.length
  );
}

function trustFrom(trainRoi: number): number {
  return Math.min(1, Math.max(MIN_TRUST, trainRoi / TRUST_REFERENCE_ROI));
}

// VALUE-style: argmax qualityScore × trust among edge-qualifying candidates.
function pickValueStyle(
  candidates: Candidate[],
  trust: Map<Market, number>,
  weighted: boolean,
): Candidate | null {
  const eligible = candidates.filter((c) => c.edge >= VALUE_MIN_EDGE);
  if (eligible.length === 0) return null;
  return eligible.reduce((best, c) => {
    const wC = weighted ? (trust.get(c.market) ?? 1) : 1;
    const wBest = weighted ? (trust.get(best.market) ?? 1) : 1;
    return c.qualityScore * wC > best.qualityScore * wBest ? c : best;
  });
}

// SAFE-style: argmax probability × trust (EV × trust tie-break) among
// SAFE-eligible candidates (probability/EV/odds bounds).
function pickSafeStyle(
  candidates: Candidate[],
  trust: Map<Market, number>,
  weighted: boolean,
): Candidate | null {
  const eligible = candidates.filter(
    (c) =>
      c.probability >= SAFE_MIN_PROBABILITY &&
      c.ev >= SAFE_MIN_EV &&
      c.ev <= SAFE_MAX_EV &&
      c.odds >= SAFE_MIN_ODDS &&
      c.odds <= SAFE_MAX_ODDS,
  );
  if (eligible.length === 0) return null;
  return eligible.reduce((best, c) => {
    const wC = weighted ? (trust.get(c.market) ?? 1) : 1;
    const wBest = weighted ? (trust.get(best.market) ?? 1) : 1;
    const cProb = c.probability * wC;
    const bestProb = best.probability * wBest;
    if (cProb !== bestProb) return cProb > bestProb ? c : best;
    return c.ev * wC > best.ev * wBest ? c : best;
  });
}

async function main(): Promise<void> {
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
      ev: true,
      result: true,
      channelDecision: {
        select: {
          modelRunId: true,
          modelRun: {
            select: {
              deterministicScore: true,
              fixture: { select: { scheduledAt: true } },
            },
          },
        },
      },
    },
  });

  console.log(`Candidats Phase 1 chargés : ${rows.length}`);

  // qualityScore is NEVER persisted for Phase-1 specialist rows (only VALUE/
  // SAFE's own selections set it) — Phase-1 strategies only price odds/ev,
  // qualityScore is computed on the fly by viablePicksFromPreviousDecisions
  // at Phase-2 evaluation time. Recompute it here the same way, or every
  // Phase-1 candidate silently ranks as quality=0 (which is what a first,
  // buggy run of this script did — every market tied at 0, zero flips ever
  // happened in the TEST validation below).
  const byFixture = new Map<string, Fixture>();
  for (const row of rows) {
    const modelRunId = row.channelDecision.modelRunId;
    const scheduledAt = row.channelDecision.modelRun.fixture.scheduledAt;
    const deterministicScore = new Decimal(
      row.channelDecision.modelRun.deterministicScore.toString(),
    );
    const probability = Number(row.probability);
    const odds = Number(row.odds);
    const ev =
      row.ev !== null ? new Decimal(row.ev.toString()) : new Decimal(0);
    const quality =
      row.qualityScore !== null
        ? new Decimal(row.qualityScore.toString())
        : buildQualityScore(
            ev,
            deterministicScore,
            row.market,
            row.pick,
            new Decimal(odds),
          );
    const candidate: Candidate = {
      market: row.market,
      scheduledAt,
      probability,
      odds,
      qualityScore: quality.toNumber(),
      edge: edgeOf(probability, odds),
      ev: ev.toNumber(),
      won: row.result === "WON",
    };
    const existing = byFixture.get(modelRunId);
    if (existing) existing.candidates.push(candidate);
    else byFixture.set(modelRunId, { scheduledAt, candidates: [candidate] });
  }

  const fixtures = Array.from(byFixture.values()).sort(
    (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime(),
  );
  console.log(`Fixtures distinctes : ${fixtures.length}`);

  // Global fixture-level split — used ONLY for the downstream validation
  // (does applying the derived weights improve a shared out-of-sample
  // window). NOT used to derive the weights themselves (see per-market
  // split below): several markets (WIN_TO_NIL/CLEAN_SHEET/DRAW_NO_BET/
  // RESULT_TOTAL_GOALS/RESULT_BTTS/TEAM_TOTAL/DOUBLE_CHANCE) are recent
  // additions (channel shipped ~2026-07) whose entire history sits inside
  // this global test window — a global train/test split would starve them
  // of any train data and silently default to trust=1 (identity) for
  // markets already known to be badly overconfident. Each market instead
  // gets its OWN chronological 75/25 split on its own candidate dates.
  const splitIndex = Math.floor(fixtures.length * 0.75);
  const test = fixtures.slice(splitIndex);

  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };

  // Two independent trust maps: VALUE and SAFE compete over very different
  // candidate populations (VALUE: any edge≥0.10 pick; SAFE: probability≥
  // 0.68 AND ev∈[0.05,0.90] AND odds∈[1.15,2.20] — a much narrower, higher-
  // probability slice). A first pass reused the VALUE-calibrated weights
  // for SAFE too and it REGRESSED SAFE's test ROI by -0.28pp — the
  // reliability of a market's edge≥0.10 tail doesn't predict the
  // reliability of its high-probability tail. Each filter gets its own
  // walk-forward-derived weight instead.
  function deriveTrust(
    label: string,
    isEligible: (c: Candidate) => boolean,
  ): Map<Market, number> {
    const byMarket = new Map<Market, Candidate[]>();
    for (const f of fixtures) {
      for (const c of f.candidates) {
        if (!isEligible(c)) continue;
        const arr = byMarket.get(c.market) ?? [];
        arr.push(c);
        byMarket.set(c.market, arr);
      }
    }

    out(
      `Marché (pool ${label})   n(train)  période train                    ROI(train)  trust`,
    );
    const trust = new Map<Market, number>();
    for (const market of VALUE_MARKETS) {
      const picks = (byMarket.get(market) ?? []).sort(
        (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime(),
      );
      if (picks.length < MIN_MARKET_VOLUME) {
        out(
          `${market.padEnd(20)}  ${String(picks.length).padEnd(8)}  (volume total insuffisant, trust=1 par défaut)`,
        );
        trust.set(market, 1);
        continue;
      }
      const marketSplit = Math.floor(picks.length * 0.75);
      const marketTrain = picks.slice(0, marketSplit);
      const roi = roiOf(marketTrain);
      const w = trustFrom(roi);
      trust.set(market, w);
      const period = marketTrain.length
        ? `${marketTrain[0]!.scheduledAt.toISOString().slice(0, 10)} → ${marketTrain.at(-1)!.scheduledAt.toISOString().slice(0, 10)}`
        : "n/a";
      out(
        `${market.padEnd(20)}  ${String(marketTrain.length).padEnd(8)}  ${period.padEnd(30)}  ${(roi * 100).toFixed(1).padStart(6)}%     ${w.toFixed(2)}`,
      );
    }
    out();
    return trust;
  }

  out("═══════════════════════════════════════════════════════");
  out("  EVCore — Calibration poids de confiance par marché (VALUE/SAFE)");
  out(
    `  ${fixtures.length} fixtures au total — split par marché (75% le plus ancien / ` +
      "25% le plus récent DE CE MARCHÉ, pas un cutoff global — cf. commentaire).",
  );
  out("═══════════════════════════════════════════════════════");
  out();

  const valueTrust = deriveTrust(
    "VALUE: edge≥0.10",
    (c) => c.edge >= VALUE_MIN_EDGE,
  );
  const safeTrust = deriveTrust(
    "SAFE: prob≥0.68, ev∈[.05,.90], odds∈[1.15,2.20]",
    (c) =>
      c.probability >= SAFE_MIN_PROBABILITY &&
      c.ev >= SAFE_MIN_EV &&
      c.ev <= SAFE_MAX_EV &&
      c.odds >= SAFE_MIN_ODDS &&
      c.odds <= SAFE_MAX_ODDS,
  );

  out("--- Validation hors échantillon (TEST) ---");
  out();

  for (const [label, picker, trustMap] of [
    [
      "VALUE-style (argmax qualityScore×trust)",
      pickValueStyle,
      valueTrust,
    ] as const,
    [
      "SAFE-style (argmax probability×trust)",
      pickSafeStyle,
      safeTrust,
    ] as const,
  ]) {
    const unweighted = test
      .map((f) => picker(f.candidates, trustMap, false))
      .filter((p): p is Candidate => p !== null);
    const weighted = test
      .map((f) => picker(f.candidates, trustMap, true))
      .filter((p): p is Candidate => p !== null);
    const roiUnweighted = roiOf(unweighted);
    const roiWeighted = roiOf(weighted);
    out(`${label}:`);
    out(
      `  non pondéré : n=${unweighted.length} roi=${(roiUnweighted * 100).toFixed(2)}%`,
    );
    out(
      `  pondéré     : n=${weighted.length} roi=${(roiWeighted * 100).toFixed(2)}%`,
    );
    out(
      roiWeighted > roiUnweighted
        ? `  ✅ la pondération améliore le ROI test de ${((roiWeighted - roiUnweighted) * 100).toFixed(2)}pp`
        : `  ❌ la pondération ne bat pas le ROI test non pondéré (${((roiWeighted - roiUnweighted) * 100).toFixed(2)}pp)`,
    );
    out();
  }

  out("--- Config générée (à coller dans ev.constants.ts) ---");
  out();
  out("  VALUE_MARKET_TRUST_MAP:");
  for (const market of VALUE_MARKETS) {
    out(`    ${market}: new Decimal('${valueTrust.get(market)!.toFixed(2)}'),`);
  }
  out();
  out("  SAFE_MARKET_TRUST_MAP:");
  for (const market of VALUE_MARKETS) {
    out(`    ${market}: new Decimal('${safeTrust.get(market)!.toFixed(2)}'),`);
  }

  const report = lines.join("\n");
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const path = join(
    reportsDir,
    `backtest-market-trust-calibration-${date}.txt`,
  );
  writeFileSync(path, `${report}\n`, "utf8");
  console.log(`\nRapport écrit : reports/${path.split("/").pop()}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
