/// <reference types="node" />
/**
 * TEAM_TOTAL : un retrait plus fort sur la tranche de cote 1,45–1,80 ?
 *
 * POURQUOI. Sur 90 jours de sélections réglées (channel_selection_deduped,
 * rang 1), TEAM_TOTAL réalise 0,83 de ce qu'il annonce entre 1,45 et 1,80
 * (1 796 jambes) et 0,96 sous 1,45 (docs/audits/2026-11-03/
 * ETUDE-STRATEGIES.md § 2.1). Plan stratégies, phase 5, étape 1.
 *
 * HYPOTHÈSE, FIXÉE AVANT LE REJEU. Ramener la probabilité d'un choix TEAM_TOTAL
 * coté dans [1,45 ; 1,80[ vers le taux de base de ce choix (côté × ligne ×
 * sens, toutes ligues confondues, mesuré sur la moitié d'ajustement) —
 * p' = base + F × (p − base), même forme que les blocs de OU_SHRINKAGE_CONFIG
 * — fait passer le ratio réalisé/annoncé de la tranche au-dessus de 0,90 hors
 * échantillon, sans dégrader la tranche sous 1,45.
 *
 * CE QUI EST REJOUÉ. La chaîne de production (production-chain.ts) à coup
 * d'envoi − 1 h, cotes assemblées à cet instant, puis decideTeamTotal avec
 * les lignes de la ligue et le classement de production
 * (probability_in_band 1,20–1,80), le retrait de tranche appliqué au
 * contexte avant la décision : il change à la fois ce qui passe le seuil, la
 * ligne retenue et ce qui est annoncé.
 *
 * PROTOCOLE. Deux moitiés par date de coup d'envoi (médiane des matchs
 * rejoués). Sur chaque moitié d'ajustement : taux de base, puis F choisi sur
 * la grille par le critère figé « |ratio de la tranche − 1| minimal » (à
 * égalité, le F le plus grand, le retrait le plus faible). Mesure unique sur
 * l'autre moitié, dans les deux sens. Expédition seulement si, dans les deux
 * sens, la tranche hors échantillon passe 0,90 et la tranche sous 1,45 ne
 * perd pas plus de 0,01 de ratio contre l'actuel (F = 1).
 *
 * Run: DATABASE_URL=... pnpm --filter @evcore/backtest-core backtest:team-total-band-shrinkage
 * Output: packages/backtest-core/reports/backtest-team-total-band-shrinkage-YYYY-MM-DD.txt
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Decimal from "decimal.js";
import { prisma } from "@evcore/db";
import {
  decideTeamTotal,
  getTeamTotalLineConfigs,
  Market,
  PRODUCTION_LINE_RANKING,
  resolvePickBetStatus,
  resolveSelectionOdds,
  type StrategyContext,
  type TeamTotalProba,
} from "@evcore/analysis-core";
import type { ReplayFixture } from "../src";
import { loaderFromEnv } from "./odds-archive";
import { replayContext } from "./production-chain";

// TEAM_TOTAL odds exist from 2026-05-31 (forward PREMATCH sync only).
const FROM_DATE = new Date("2026-06-01T00:00:00.000Z");
const DECISION_LEAD_MS = 60 * 60 * 1000;
const BAND = { min: 1.45, max: 1.8 } as const;
const FACTOR_GRID = [1, 0.8, 0.6, 0.4, 0.2, 0] as const;
const SHIP_MIN_BAND_RATIO = 0.9;
const SHIP_MAX_BELOW_LOSS = 0.01;
const Z95 = 1.96;

type Side = "HOME" | "AWAY";
type PickKey = keyof TeamTotalProba;
type Item = { fixture: ReplayFixture; context: StrategyContext };
type Bases = Map<string, Decimal>;

type Bucket = { n: number; announced: number; won: number; odds: number };
type Summary = {
  fixtures: number;
  selected: number;
  below: Bucket;
  band: Bucket;
  above: Bucket;
};

const emptyBucket = (): Bucket => ({ n: 0, announced: 0, won: 0, odds: 0 });

function ratio(bucket: Bucket): number {
  return bucket.announced > 0 ? bucket.won / bucket.announced : 0;
}

function formatBucket(bucket: Bucket): string {
  if (bucket.n === 0) return "n     0";
  const real = bucket.won / bucket.n;
  const ann = bucket.announced / bucket.n;
  const half = Z95 * Math.sqrt((real * (1 - real)) / bucket.n);
  return (
    `n ${String(bucket.n).padStart(5)} annoncé ${ann.toFixed(3)} réalisé ${real.toFixed(3)} ` +
    `ratio ${(real / ann).toFixed(3)} [${((real - half) / ann).toFixed(3)} ; ${((real + half) / ann).toFixed(3)}] ` +
    `cote ${(bucket.odds / bucket.n).toFixed(2)}`
  );
}

function marketOf(side: Side): Market {
  return side === "HOME" ? Market.TEAM_TOTAL_HOME : Market.TEAM_TOTAL_AWAY;
}

function pickWins(pick: string, goals: number): boolean {
  const [direction, whole, decimal] = pick.split("_");
  const line = Number(`${whole}.${decimal}`);
  return direction === "OVER" ? goals > line : goals < line;
}

/** Taux de base de chaque choix (côté × ligne × sens), toutes ligues. */
function measureBases(items: readonly Item[]): Bases {
  const counts = new Map<string, { n: number; won: number }>();
  for (const { fixture, context } of items) {
    for (const side of ["HOME", "AWAY"] as const) {
      const map =
        side === "HOME"
          ? context.probabilities.teamTotalHome
          : context.probabilities.teamTotalAway;
      const goals = side === "HOME" ? fixture.homeScore : fixture.awayScore;
      for (const pick of Object.keys(map)) {
        const key = `${side}:${pick}`;
        const count = counts.get(key) ?? { n: 0, won: 0 };
        count.n += 1;
        count.won += pickWins(pick, goals) ? 1 : 0;
        counts.set(key, count);
      }
    }
  }
  const bases: Bases = new Map();
  for (const [key, count] of counts) {
    bases.set(key, new Decimal(count.won).dividedBy(count.n));
  }
  return bases;
}

function shrinkSide(input: {
  context: StrategyContext;
  side: Side;
  factor: number;
  bases: Bases;
}): TeamTotalProba {
  const { context, side, factor, bases } = input;
  const map =
    side === "HOME"
      ? context.probabilities.teamTotalHome
      : context.probabilities.teamTotalAway;
  const shrunk: TeamTotalProba = { ...map };
  for (const pick of Object.keys(map) as PickKey[]) {
    const probability = map[pick];
    const base = bases.get(`${side}:${pick}`);
    if (probability === undefined || base === undefined) continue;
    const odds = resolveSelectionOdds(context.odds, marketOf(side), pick);
    if (odds === null || odds.lessThan(BAND.min) || odds.gte(BAND.max)) {
      continue;
    }
    shrunk[pick] = base.plus(probability.minus(base).times(factor));
  }
  return shrunk;
}

function withBandShrinkage(input: {
  context: StrategyContext;
  factor: number;
  bases: Bases;
}): StrategyContext {
  if (input.factor === 1) return input.context;
  return {
    ...input.context,
    probabilities: {
      ...input.context.probabilities,
      teamTotalHome: shrinkSide({ ...input, side: "HOME" }),
      teamTotalAway: shrinkSide({ ...input, side: "AWAY" }),
    },
  };
}

function summarize(input: {
  items: readonly Item[];
  factor: number;
  bases: Bases;
}): Summary {
  const summary: Summary = {
    fixtures: input.items.length,
    selected: 0,
    below: emptyBucket(),
    band: emptyBucket(),
    above: emptyBucket(),
  };
  for (const { fixture, context } of input.items) {
    const decision = decideTeamTotal(
      withBandShrinkage({
        context,
        factor: input.factor,
        bases: input.bases,
      }),
      getTeamTotalLineConfigs(fixture.competitionCode),
      PRODUCTION_LINE_RANKING.TEAM_TOTAL,
    );
    if (decision.status !== "SELECTED") continue;
    const selection = decision.selections[0];
    if (!selection) continue;
    summary.selected += 1;
    if (selection.odds === undefined) continue;
    const status = resolvePickBetStatus(
      selection.market,
      selection.pick,
      fixture.homeScore,
      fixture.awayScore,
    );
    if (status !== "WON" && status !== "LOST") continue;
    const odds = selection.odds.toNumber();
    const bucket =
      odds < BAND.min
        ? summary.below
        : odds < BAND.max
          ? summary.band
          : summary.above;
    bucket.n += 1;
    bucket.announced += selection.probability.toNumber();
    bucket.won += status === "WON" ? 1 : 0;
    bucket.odds += odds;
  }
  return summary;
}

function pickFactor(input: { items: readonly Item[]; bases: Bases }): number {
  let best: { factor: number; distance: number } | null = null;
  for (const factor of FACTOR_GRID) {
    const distance = Math.abs(ratio(summarize({ ...input, factor }).band) - 1);
    // Grid is descending: strict < keeps the larger factor on a tie.
    if (best === null || distance < best.distance) best = { factor, distance };
  }
  return best?.factor ?? 1;
}

/**
 * Only what decideTeamTotal reads, laid on a shared template: the full
 * context of 6 000 matches (every market's probabilities, odds and sources)
 * does not fit in the heap.
 */
function slim(
  context: StrategyContext,
  template: StrategyContext,
): StrategyContext {
  return {
    ...template,
    fixture: context.fixture,
    competitionCode: context.competitionCode,
    probabilities: {
      ...template.probabilities,
      teamTotalHome: context.probabilities.teamTotalHome,
      teamTotalAway: context.probabilities.teamTotalAway,
    },
    odds:
      context.odds === null
        ? null
        : {
            ...(template.odds ?? context.odds),
            sources: undefined,
            teamTotalHomeOdds: context.odds.teamTotalHomeOdds,
            teamTotalAwayOdds: context.odds.teamTotalAwayOdds,
          },
  };
}

async function loadItems(out: (line?: string) => void): Promise<Item[]> {
  const { loader, close } = await loaderFromEnv();
  const fixtures = (
    await loader.listFixtures({ from: FROM_DATE, to: new Date() })
  ).filter((f) => getTeamTotalLineConfigs(f.competitionCode).length > 0);
  out(
    `${fixtures.length} matchs terminés dans des ligues où TEAM_TOTAL tourne.`,
  );
  const items: Item[] = [];
  // One full context is kept as the shape every slimmed one is built on.
  let template: StrategyContext | null = null;
  let skipped = 0;
  const startedAt = Date.now();
  const BATCH = 200;
  for (let offset = 0; offset < fixtures.length; offset += BATCH) {
    const batch = fixtures.slice(offset, offset + BATCH);
    const oddsByFixture = await loader.loadOddsBatch(
      batch.map((f) => ({
        fixtureId: f.id,
        asOf: new Date(f.scheduledAt.getTime() - DECISION_LEAD_MS),
      })),
    );
    for (const fixture of batch) {
      const asOf = new Date(fixture.scheduledAt.getTime() - DECISION_LEAD_MS);
      const odds = oddsByFixture.get(fixture.id) ?? null;
      const context =
        odds === null
          ? null
          : await replayContext({ loader, fixture, odds, asOf });
      if (!context) {
        skipped += 1;
        continue;
      }
      template ??= context;
      items.push({ fixture, context: slim(context, template) });
    }
    console.log(
      `[${Math.min(offset + BATCH, fixtures.length)}/${fixtures.length}] ${((Date.now() - startedAt) / 1000).toFixed(0)}s`,
    );
  }
  close();
  out(
    `${items.length} rejoués, ${skipped} ignorés (team_stats ou cotes absents à asOf).`,
  );
  return items;
}

async function main() {
  const generatedAt = new Date();
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const reportsDir = join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outputPath = join(
    reportsDir,
    `backtest-team-total-band-shrinkage-${dateLabel}.txt`,
  );
  const lines: string[] = [];
  const out = (line = "") => {
    console.log(line);
    lines.push(line);
  };
  out(
    `TEAM_TOTAL, retrait sur la tranche ${BAND.min}–${BAND.max} — ${generatedAt.toISOString()}`,
  );
  out(
    `Décision à coup d'envoi − 1 h, depuis ${FROM_DATE.toISOString().slice(0, 10)}. Grille F : ${FACTOR_GRID.join(" / ")}.`,
  );
  out();

  const items = await loadItems(out);
  const sorted = [...items].sort(
    (a, b) => a.fixture.scheduledAt.getTime() - b.fixture.scheduledAt.getTime(),
  );
  const middle = sorted[Math.floor(sorted.length / 2)];
  if (!middle) throw new Error("no replayed fixture");
  const split = middle.fixture.scheduledAt;
  const halves = {
    ancienne: sorted.filter((i) => i.fixture.scheduledAt < split),
    récente: sorted.filter((i) => i.fixture.scheduledAt >= split),
  };
  out(
    `Coupure : ${split.toISOString().slice(0, 16)} — ancienne ${halves.ancienne.length} matchs, récente ${halves.récente.length}.`,
  );
  out();

  const verdicts: boolean[] = [];
  for (const [fitName, testName] of [
    ["ancienne", "récente"],
    ["récente", "ancienne"],
  ] as const) {
    const fit = halves[fitName];
    const test = halves[testName];
    const bases = measureBases(fit);
    out(
      `== Ajustement sur la moitié ${fitName}, test sur la moitié ${testName} ==`,
    );
    out(
      `Taux de base (${fitName}) : ` +
        [...bases.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, base]) => `${key} ${base.toFixed(3)}`)
          .join(" · "),
    );
    for (const [name, half] of [
      [fitName, fit],
      [testName, test],
    ] as const) {
      out(`  moitié ${name}${half === test ? " (hors échantillon)" : ""}`);
      for (const factor of FACTOR_GRID) {
        const s = summarize({ items: half, factor, bases });
        out(
          `    F=${factor.toFixed(1)} sélections ${s.selected}/${s.fixtures}`,
        );
        out(`      < ${BAND.min}       ${formatBucket(s.below)}`);
        out(`      ${BAND.min}–${BAND.max}  ${formatBucket(s.band)}`);
        if (s.above.n > 0)
          out(`      ≥ ${BAND.max}       ${formatBucket(s.above)}`);
      }
    }
    const chosen = pickFactor({ items: fit, bases });
    const current = summarize({ items: test, factor: 1, bases });
    const candidate = summarize({ items: test, factor: chosen, bases });
    const bandOk = ratio(candidate.band) > SHIP_MIN_BAND_RATIO;
    const belowOk =
      ratio(candidate.below) >= ratio(current.below) - SHIP_MAX_BELOW_LOSS;
    verdicts.push(bandOk && belowOk);
    out(`  F retenu sur ${fitName} : ${chosen.toFixed(1)}`);
    out(
      `  hors échantillon (${testName}) : tranche ${ratio(current.band).toFixed(3)} → ${ratio(candidate.band).toFixed(3)} (${bandOk ? "> 0,90" : "≤ 0,90"}), sous ${BAND.min} ${ratio(current.below).toFixed(3)} → ${ratio(candidate.below).toFixed(3)} (${belowOk ? "tenu" : "dégradé"})`,
    );
    out();
  }
  out(
    verdicts.every(Boolean)
      ? "VERDICT : l'hypothèse tient dans les deux sens — expédier."
      : "VERDICT : l'hypothèse ne tient pas hors échantillon dans les deux sens — rien n'est expédié.",
  );

  writeFileSync(outputPath, lines.join("\n") + "\n");
  console.log(`Rapport écrit : ${outputPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
