/**
 * Nouveaux marchés de la phase 3 (plan des stratégies, 03/11) : par marché,
 * book et tranche de cote, la fréquence du marché sans sa marge contre la
 * fréquence réalisée, avec son IC à 95 %. C'est ce que lira la phase 4
 * avant tout produit.
 *
 * Cotes : `odds_closing_line`, dernière cote relevée au plus --max-hours
 * avant le coup d'envoi. Issues : les résolveurs du règlement
 * (`resolveStatMarketBetStatus`, analysis-core) sur les stats, événements,
 * compositions et stats joueurs du match — les mêmes règles que le
 * règlement des coupons, inconnu compté à part.
 *
 * Usage :
 *   pnpm --filter @evcore/backtest-core report:new-markets
 *   pnpm --filter @evcore/backtest-core report:new-markets -- --days 28 --max-hours 3 --out <fichier.md>
 */
import { writeFileSync } from "node:fs";
import {
  buildMatchFacts,
  MATCH_FACT_STAT_TYPES,
  resolveStatMarketBetStatus,
  STAT_SETTLED_MARKETS,
  type Market,
  type MatchFacts,
  type MatchFactsRows,
} from "@evcore/analysis-core";
import { Prisma, prisma } from "@evcore/db";
import {
  buildNewMarketsReport,
  renderNewMarketsReport,
  type ClosingQuote,
} from "../src/new-markets-report";

const DEFAULT_DAYS = 28;
// Les cotes de buteurs ne sont plus rafraîchies à ~2 h du coup d'envoi :
// une fenêtre plus courte en perdrait l'essentiel.
const DEFAULT_MAX_HOURS = 3;

function option(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value) throw new Error(`${name} requiert une valeur`);
  return value;
}

function numberOption(name: string, fallback: number): number {
  const raw = option(name);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} : nombre positif attendu`);
  }
  return value;
}

type QuoteRow = {
  fixtureId: string;
  bookmaker: string;
  market: string;
  pick: string;
  line: string | null;
  odds: string;
};

async function loadQuotes(input: {
  from: Date;
  to: Date;
  maxHours: number;
}): Promise<ClosingQuote[]> {
  const markets = [...STAT_SETTLED_MARKETS];
  const rows = await prisma.$queryRaw<QuoteRow[]>(Prisma.sql`
    SELECT cl."fixtureId", cl.bookmaker, cl.market::text AS market, cl.pick,
           cl.line::text AS line, cl.odds::text AS odds
    FROM public.odds_closing_line cl
    JOIN public.fixture f ON f.id = cl."fixtureId"
    WHERE cl.market::text IN (${Prisma.join(markets)})
      AND cl.odds IS NOT NULL
      AND cl.pick IS NOT NULL
      AND cl."hoursBeforeKickoff" >= 0
      AND cl."hoursBeforeKickoff" <= ${input.maxHours}
      AND f.status = 'FINISHED'
      AND f."scheduledAt" >= ${input.from}
      AND f."scheduledAt" < ${input.to}
  `);
  return rows.map((row) => ({
    fixtureId: row.fixtureId,
    bookmaker: row.bookmaker,
    market: row.market,
    pick: row.pick,
    line: row.line === null ? null : Number(row.line),
    odds: row.odds,
  }));
}

type FixtureRow = {
  id: string;
  status: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  eventsSyncedAt: Date | null;
};

async function loadFacts(
  fixtureIds: readonly string[],
): Promise<Map<string, MatchFacts>> {
  if (fixtureIds.length === 0) return new Map();
  const ids = Prisma.sql`${[...fixtureIds]}::uuid[]`;
  const [fixtures, statistics, events, lineups, playerStatistics] =
    await Promise.all([
      prisma.$queryRaw<FixtureRow[]>(Prisma.sql`
        SELECT id, status::text AS status, "homeTeamId", "awayTeamId",
               "homeScore", "awayScore", "eventsSyncedAt"
        FROM public.fixture WHERE id = ANY(${ids})`),
      prisma.$queryRaw<
        { fixtureId: string; teamId: string; type: string; value: string }[]
      >(Prisma.sql`
        SELECT "fixtureId", "teamId", type, value::text AS value
        FROM public.fixture_statistic
        WHERE "fixtureId" = ANY(${ids})
          AND source = 'API_FOOTBALL'
          AND type IN (${Prisma.join(Object.values(MATCH_FACT_STAT_TYPES))})`),
      prisma.$queryRaw<
        (MatchFactsRows["events"][number] & { fixtureId: string })[]
      >(Prisma.sql`
        SELECT "fixtureId", "teamId", ordinal, minute, "extraMinute",
               type::text AS type, detail, comments, "playerExternalId",
               "playerName", "assistExternalId"
        FROM public.fixture_event WHERE "fixtureId" = ANY(${ids})`),
      prisma.$queryRaw<
        (MatchFactsRows["lineups"][number] & { fixtureId: string })[]
      >(Prisma.sql`
        SELECT "fixtureId", "teamId", "playerExternalId", starter
        FROM public.fixture_lineup WHERE "fixtureId" = ANY(${ids})`),
      prisma.$queryRaw<
        (MatchFactsRows["playerStatistics"][number] & { fixtureId: string })[]
      >(Prisma.sql`
        SELECT "fixtureId", "teamId", "playerExternalId", minutes,
               "shotsTotal", "shotsOn"
        FROM public.fixture_player_statistic WHERE "fixtureId" = ANY(${ids})`),
    ]);

  // Grouped once by fixture: a filter per fixture would be quadratic.
  const byFixture = <T extends { fixtureId: string }>(rows: readonly T[]) => {
    const groups = new Map<string, T[]>();
    for (const row of rows) {
      const group = groups.get(row.fixtureId);
      if (group) group.push(row);
      else groups.set(row.fixtureId, [row]);
    }
    return (id: string): T[] => groups.get(id) ?? [];
  };
  const statisticsOf = byFixture(statistics);
  const eventsOf = byFixture(events);
  const lineupsOf = byFixture(lineups);
  const playerStatisticsOf = byFixture(playerStatistics);
  const facts = new Map<string, MatchFacts>();
  for (const fixture of fixtures) {
    facts.set(
      fixture.id,
      buildMatchFacts({
        finished: fixture.status === "FINISHED",
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        homeScore: fixture.homeScore,
        awayScore: fixture.awayScore,
        eventsReported: fixture.eventsSyncedAt !== null,
        statistics: statisticsOf(fixture.id).map((row) => ({
          teamId: row.teamId,
          type: row.type,
          value: Number(row.value),
        })),
        events: eventsOf(fixture.id),
        lineups: lineupsOf(fixture.id),
        playerStatistics: playerStatisticsOf(fixture.id),
      }),
    );
  }
  return facts;
}

async function main(): Promise<void> {
  const days = numberOption("--days", DEFAULT_DAYS);
  const maxHours = numberOption("--max-hours", DEFAULT_MAX_HOURS);
  const out = option("--out");
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  try {
    const quotes = await loadQuotes({ from, to, maxHours });
    const facts = await loadFacts([...new Set(quotes.map((q) => q.fixtureId))]);
    const rows = buildNewMarketsReport({
      quotes,
      outcomeOf: (quote) => {
        const matchFacts = facts.get(quote.fixtureId);
        return matchFacts === undefined
          ? null
          : resolveStatMarketBetStatus({
              market: quote.market as Market,
              pick: quote.pick,
              line: quote.line,
              facts: matchFacts,
            });
      },
    });
    const report = renderNewMarketsReport({
      rows,
      from,
      to,
      maxHoursBeforeKickoff: maxHours,
    });
    if (out) writeFileSync(out, report);
    console.log(report);
    console.log(
      `${quotes.length} cotes de clôture, ${facts.size} matchs, ${rows.length} cellules.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main();
