/// <reference types="node" />
/**
 * Étude de `calibration_alert` (garde-fou de cohérence modèle↔marché) pour
 * OVER_UNDER — TODO.md flague qu'`assessMarketCoherence()` ne prend en
 * entrée que les probabilités 1X2, jamais O/U, alors que le post-mortem du
 * 13-14/08 a montré un écart de +19pp (rawPoisson vs calibré) sur une jambe
 * Under 3.5 qui a cassé un coupon — du même ordre que les écarts qui ont
 * fait exclure deux autres jambes du même coupon via `calibration_alert`.
 *
 * Contrairement au shrinkage (où le facteur sort mécaniquement d'un
 * walk-forward Brier), les seuils `MAX_DIVERGENCE`/`FAVORITE_FLIP_MIN_GAP`
 * du gate 1X2 (0.30/0.15) sont calibrés sur une distribution de cotes 1X2 —
 * les réutiliser sans vérifier serait une recalibration à l'aveugle. Ce
 * script mesure directement, sur les paris OVER_UNDER RÉELS déjà réglés
 * (probEstimated = la proba que le modèle affichait au moment du pari),
 * si un écart modèle↔marché élevé corrèle avec un ROI réel dégradé — même
 * démarche que l'audit qui a dû produire les seuils 1X2 à l'origine.
 *
 * Méthode par pari réglé :
 *   1. médiane des probas implicites (1/cote, marge NON retirée — même
 *      choix que `computeMedianImpliedProbabilities` pour 1X2) sur la même
 *      ligne (ex. pick="UNDER_3_5" → bookmakers cotant OVER_3_5/UNDER_3_5)
 *      à travers tous les bookmakers ayant coté cette ligne pour cette
 *      fixture ;
 *   2. divergence = |probEstimated − médiane implicite sur le même sens
 *      (OVER si probEstimated est la proba d'un pick OVER, etc.)| ;
 *   3. favorite_flip = le modèle et le marché ne sont pas d'accord sur quel
 *      côté (OVER/UNDER) est favori, avec un écart suffisant.
 *
 * Run: pnpm --filter @evcore/db db:backtest:calibration-alert-over-under
 * Output: packages/db/reports/backtest-calibration-alert-over-under-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { Market } from "../src/generated/prisma/client";
import { prisma } from "../src/client";

const MIN_BOOKMAKERS = 2;
const MIN_BUCKET_VOLUME = 15;

const DIVERGENCE_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: "0.00-0.09", min: 0, max: 0.1 },
  { label: "0.10-0.19", min: 0.1, max: 0.2 },
  { label: "0.20-0.29", min: 0.2, max: 0.3 },
  { label: "0.30-0.39", min: 0.3, max: 0.4 },
  { label: "0.40+", min: 0.4, max: Infinity },
];
function bucketFor(divergence: number): string {
  return DIVERGENCE_BUCKETS.find(
    (b) => divergence >= b.min && divergence < b.max,
  )!.label;
}

type BetRow = {
  id: string;
  fixtureId: string;
  pick: string;
  probEstimated: number;
  oddsSnapshot: number | null;
  status: "WON" | "LOST";
};

type OddsRow = { fixtureId: string; pick: string; odds: number };

function lineOf(pick: string): {
  side: "OVER" | "UNDER";
  linePicks: [string, string];
} {
  const match = /^(OVER|UNDER)(_\d_\d)?$/.exec(pick);
  if (!match) throw new Error(`Unexpected OVER_UNDER pick: ${pick}`);
  const side = match[1]! as "OVER" | "UNDER";
  const suffix = match[2] ?? "";
  return { side, linePicks: [`OVER${suffix}`, `UNDER${suffix}`] };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-calibration-alert-over-under-${dateLabel}.txt`,
  );
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };

  out("Chargement des paris OVER_UNDER réglés (WON/LOST)...");
  const betsRaw = await prisma.bet.findMany({
    where: {
      market: Market.OVER_UNDER,
      status: { in: ["WON", "LOST"] },
    },
    select: {
      id: true,
      fixtureId: true,
      pick: true,
      probEstimated: true,
      oddsSnapshot: true,
      status: true,
    },
  });
  const bets: BetRow[] = betsRaw.map((b) => ({
    id: b.id,
    fixtureId: b.fixtureId,
    pick: b.pick,
    probEstimated: Number(b.probEstimated),
    oddsSnapshot: b.oddsSnapshot ? Number(b.oddsSnapshot) : null,
    status: b.status as "WON" | "LOST",
  }));
  out(`  ${bets.length} paris réglés trouvés.`);

  out("Chargement des cotes OVER_UNDER (toutes lignes, tous bookmakers)...");
  const fixtureIds = Array.from(new Set(bets.map((b) => b.fixtureId)));
  const oddsRaw = await prisma.oddsSnapshot.findMany({
    where: {
      fixtureId: { in: fixtureIds },
      market: Market.OVER_UNDER,
      odds: { not: null },
    },
    select: { fixtureId: true, bookmaker: true, pick: true, odds: true },
  });
  const oddsByFixture = new Map<string, OddsRow[]>();
  for (const row of oddsRaw) {
    if (!row.pick) continue;
    const arr = oddsByFixture.get(row.fixtureId) ?? [];
    arr.push({
      fixtureId: row.fixtureId,
      pick: row.pick,
      odds: Number(row.odds),
    });
    oddsByFixture.set(row.fixtureId, arr);
  }
  out(
    `  ${oddsRaw.length} lignes de cotes chargées pour ${fixtureIds.length} fixtures.`,
  );

  type Point = {
    divergence: number;
    favoriteFlip: boolean;
    odds: number;
    won: boolean;
  };
  const points: Point[] = [];
  let skippedNoOdds = 0;
  let skippedTooFewBookmakers = 0;

  for (const bet of bets) {
    if (bet.oddsSnapshot === null) continue;
    const { side, linePicks } = lineOf(bet.pick);
    const [overPick, underPick] = linePicks;
    const fixtureOdds = oddsByFixture.get(bet.fixtureId) ?? [];
    const overOdds = fixtureOdds
      .filter((r) => r.pick === overPick)
      .map((r) => r.odds);
    const underOdds = fixtureOdds
      .filter((r) => r.pick === underPick)
      .map((r) => r.odds);
    if (overOdds.length === 0 && underOdds.length === 0) {
      skippedNoOdds++;
      continue;
    }
    const bookmakerCount = Math.max(overOdds.length, underOdds.length);
    if (bookmakerCount < MIN_BOOKMAKERS) {
      skippedTooFewBookmakers++;
      continue;
    }

    const medianImpliedOver =
      overOdds.length > 0 ? median(overOdds.map((o) => 1 / o)) : null;
    const medianImpliedUnder =
      underOdds.length > 0 ? median(underOdds.map((o) => 1 / o)) : null;
    if (medianImpliedOver === null || medianImpliedUnder === null) {
      skippedNoOdds++;
      continue;
    }

    // probEstimated is the model's prob for the STAKED side; derive the
    // model's prob for OVER to determine the model's own favorite.
    const modelOverProb =
      side === "OVER" ? bet.probEstimated : 1 - bet.probEstimated;
    const modelFavorite = modelOverProb >= 0.5 ? "OVER" : "UNDER";
    const marketFavorite =
      medianImpliedOver >= medianImpliedUnder ? "OVER" : "UNDER";
    const impliedAtModelFavorite =
      modelFavorite === "OVER" ? medianImpliedOver : medianImpliedUnder;
    const modelProbAtFavorite =
      modelFavorite === "OVER" ? modelOverProb : 1 - modelOverProb;
    const divergence = Math.abs(modelProbAtFavorite - impliedAtModelFavorite);
    const favoriteFlip = modelFavorite !== marketFavorite;

    points.push({
      divergence,
      favoriteFlip,
      odds: bet.oddsSnapshot,
      won: bet.status === "WON",
    });
  }
  out(
    `  ${points.length} paris exploitables (${skippedNoOdds} sans cote sur la même ligne, ` +
      `${skippedTooFewBookmakers} avec < ${MIN_BOOKMAKERS} bookmakers).`,
  );

  out();
  out("═══════════════════════════════════════════════════════");
  out(
    "  EVCore — calibration_alert pour OVER_UNDER : ROI par tranche de divergence",
  );
  out(
    `  ${dateLabel} — paris OVER_UNDER réels réglés, probEstimated vs médiane implicite bookmaker`,
  );
  out("═══════════════════════════════════════════════════════");
  out();

  const groups = new Map<string, Point[]>();
  for (const p of points) {
    const key = bucketFor(p.divergence);
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  out(
    "Par tranche de divergence |proba modèle − médiane implicite bookmaker| :",
  );
  for (const bucket of DIVERGENCE_BUCKETS) {
    const pts = groups.get(bucket.label);
    if (!pts || pts.length < MIN_BUCKET_VOLUME) {
      out(
        `  ${bucket.label.padEnd(12)} n=${pts ? pts.length : 0} (volume insuffisant, < ${MIN_BUCKET_VOLUME})`,
      );
      continue;
    }
    const n = pts.length;
    const hitRate = pts.reduce((s, p) => s + (p.won ? 1 : 0), 0) / n;
    const roi = pts.reduce((s, p) => s + (p.won ? p.odds - 1 : -1), 0) / n;
    const flipCount = pts.filter((p) => p.favoriteFlip).length;
    out(
      `  ${bucket.label.padEnd(12)} n=${String(n).padEnd(5)} taux réussite=${(100 * hitRate).toFixed(1)}%  ` +
        `ROI réel=${(100 * roi).toFixed(1)}%  favorite_flip=${flipCount}/${n}`,
    );
  }

  out();
  out("Favorite_flip vs non-flip (indépendamment de la divergence) :");
  const flipPts = points.filter((p) => p.favoriteFlip);
  const noFlipPts = points.filter((p) => !p.favoriteFlip);
  for (const [label, pts] of [
    ["favorite_flip", flipPts],
    ["pas de flip", noFlipPts],
  ] as const) {
    if (pts.length < MIN_BUCKET_VOLUME) {
      out(`  ${label.padEnd(14)} n=${pts.length} (volume insuffisant)`);
      continue;
    }
    const n = pts.length;
    const hitRate = pts.reduce((s, p) => s + (p.won ? 1 : 0), 0) / n;
    const roi = pts.reduce((s, p) => s + (p.won ? p.odds - 1 : -1), 0) / n;
    out(
      `  ${label.padEnd(14)} n=${String(n).padEnd(5)} taux réussite=${(100 * hitRate).toFixed(1)}%  ROI réel=${(100 * roi).toFixed(1)}%`,
    );
  }

  out();
  out(
    "Contrôle du confondant 'proche de 50%' — flip/non-flip croisé avec la divergence " +
      "(un flip à divergence quasi nulle veut juste dire que le modèle et le marché sont " +
      "tous les deux proches de 50/50, pas un vrai désaccord) :",
  );
  for (const divThreshold of [0.1]) {
    for (const [label, pts] of [
      [
        `flip, divergence >= ${divThreshold}`,
        flipPts.filter((p) => p.divergence >= divThreshold),
      ],
      [
        `flip, divergence < ${divThreshold}`,
        flipPts.filter((p) => p.divergence < divThreshold),
      ],
      [
        `non-flip, divergence >= ${divThreshold}`,
        noFlipPts.filter((p) => p.divergence >= divThreshold),
      ],
      [
        `non-flip, divergence < ${divThreshold}`,
        noFlipPts.filter((p) => p.divergence < divThreshold),
      ],
    ] as const) {
      if (pts.length < MIN_BUCKET_VOLUME) {
        out(`  ${label.padEnd(28)} n=${pts.length} (volume insuffisant)`);
        continue;
      }
      const n = pts.length;
      const hitRate = pts.reduce((s, p) => s + (p.won ? 1 : 0), 0) / n;
      const roi = pts.reduce((s, p) => s + (p.won ? p.odds - 1 : -1), 0) / n;
      out(
        `  ${label.padEnd(28)} n=${String(n).padEnd(5)} taux réussite=${(100 * hitRate).toFixed(1)}%  ROI réel=${(100 * roi).toFixed(1)}%`,
      );
    }
  }

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
