import { Injectable } from '@nestjs/common';
import { Prisma } from '@evcore/db';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma.service';
import {
  OPERATOR_BOOKMAKERS,
  priceOutcomeGroups,
  shinOutcomeGroups,
  shinProbabilities,
} from '@evcore/analysis-core';

export type PlayableQuoteKey = {
  fixtureId: string;
  market: string;
  pick: string;
  /**
   * Ligne des marchés qui la portent en colonne (corners) ; absente ou nulle
   * pour les autres, dont la ligne est dans `pick`.
   */
  line?: number | null;
};

export type PlayableQuote = PlayableQuoteKey & {
  /** Prix chez le book de l'utilisateur quand il cote le choix, sinon null. */
  operatorOdds: number | null;
  operatorBookmaker: string | null;
  /**
   * Marge payée chez ce book sur le groupe d'issues complet du choix (somme
   * des implicites rapportée au nombre d'issues gagnantes, moins 1) ; null
   * si le book ne cote pas tout le groupe. C'est le coût réel du joueur
   * (docs/audits/2026-10-29/MARGES-1XBET.md).
   */
  operatorMargin: number | null;
  /**
   * Fréquence sans marge de ce choix chez ce book, par la méthode de Shin sur
   * le même groupe d'issues complet (la double chance par son 1X2) ; null si
   * le groupe est incomplet. La chance affichée au-dessus de 1,80
   * (docs/refonte-ui/06 § 2, 07 § 4), toujours lue avec la cote qui va avec.
   */
  operatorFairProbability: number | null;
  /** Prix le plus bas de tous les books relevés (le pire cas). */
  lowestOdds: number | null;
  lowestBookmaker: string | null;
};

export function playableQuoteKey(key: PlayableQuoteKey): string {
  const base = `${key.fixtureId}|${key.market}|${key.pick}`;
  // La ligne n'entre dans la clé que pour les marchés qui l'ont en colonne :
  // les clés des autres marchés ne changent pas.
  return key.line == null ? base : `${base}|${Number(key.line)}`;
}

type QuoteRow = {
  fixtureId: string;
  market: string;
  pick: string;
  line: number | null;
  bookmaker: string;
  odds: number;
  snapshotAt: Date;
};

/**
 * The CTE `latest`: each book's last price before kick-off on each pick of
 * these markets (line-less), one row per fixture, market, pick and book.
 * Read in `odds_latest` (kept by a trigger on `odds_snapshot`, B17c); a
 * fixture without any row there is read in the history, as is everything
 * when `asOf` asks for the price known at a past instant.
 */
function latestPrices(input: {
  fixtureIds: readonly string[];
  markets: readonly string[];
  bookmakers: readonly string[] | null;
  asOf: Date | null;
}): Prisma.Sql {
  const books = (alias: string) =>
    input.bookmakers
      ? Prisma.sql`AND ${Prisma.raw(alias)}.bookmaker = ANY(ARRAY[${Prisma.join(input.bookmakers)}]::text[])`
      : Prisma.empty;
  const fromHistory = (fixtures: Prisma.Sql) => Prisma.sql`
    SELECT DISTINCT ON (o."fixtureId", o.market, o.pick, o.bookmaker)
           o."fixtureId", o.market, o.pick, o.bookmaker, o.odds,
           o."homeOdds", o."drawOdds", o."awayOdds", o."snapshotAt"
    FROM public.odds_snapshot o
    JOIN public.fixture f ON f.id = o."fixtureId"
    WHERE o."fixtureId" IN (${fixtures})
      AND o.market::text = ANY(ARRAY[${Prisma.join(input.markets)}]::text[])
      AND o.line IS NULL
      ${books('o')}
      AND o."snapshotAt" <= f."scheduledAt"
      ${input.asOf ? Prisma.sql`AND coalesce(o."observedAt", o."snapshotAt") <= ${input.asOf}` : Prisma.empty}
    ORDER BY o."fixtureId", o.market, o.pick, o.bookmaker, o."snapshotAt" DESC
  `;
  const wanted = Prisma.sql`SELECT unnest(ARRAY[${Prisma.join(input.fixtureIds)}]::uuid[])`;
  if (input.asOf) return Prisma.sql`latest AS (${fromHistory(wanted)})`;
  return Prisma.sql`
    missing AS (
      SELECT w.id FROM (${wanted}) AS w(id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.odds_latest x WHERE x."fixtureId" = w.id
      )
    ),
    latest AS (
      SELECT l."fixtureId", l.market, l.pick, l.bookmaker, l.odds,
             l."homeOdds", l."drawOdds", l."awayOdds", l."snapshotAt"
      FROM public.odds_latest l
      WHERE l."fixtureId" = ANY(ARRAY[${Prisma.join(input.fixtureIds)}]::uuid[])
        AND l.market::text = ANY(ARRAY[${Prisma.join(input.markets)}]::text[])
        AND l.line IS NULL
        ${books('l')}
      UNION ALL
      (${fromHistory(Prisma.sql`SELECT id FROM missing`)})
    )
  `;
}

/**
 * Dernier prix d'avant coup d'envoi de chaque book sur chaque choix demandé,
 * réduit à deux chiffres : le prix chez le book de l'utilisateur et le prix
 * le plus bas du relevé. Lignes nulles seulement (le pick porte sa ligne
 * pour les marchés d'avant le 2026-09-15 ; l'Asian Handicap n'est pas
 * affiché).
 */
@Injectable()
export class PlayableOddsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `asOf` : le prix tel qu'on le connaissait à cet instant (relevé observé
   * à `asOf` ou avant), pour coter une jambe au moment de sa publication.
   * Sans lui, le dernier prix d'avant coup d'envoi.
   */
  async findPlayableQuotes(
    keys: readonly PlayableQuoteKey[],
    opts: {
      asOf?: Date;
      /**
       * Only the players' book: a screen that shows the 1xBet price reads a
       * tenth of the rows. `lowestOdds` is then the lowest among those books.
       */
      operatorOnly?: boolean;
    } = {},
  ): Promise<Map<string, PlayableQuote>> {
    const lined = keys.filter((key) => key.line != null);
    const result = await this.findLineQuotes(lined, opts);
    keys = keys.filter((key) => key.line == null);
    if (keys.length === 0) return result;
    const fixtureIds = [...new Set(keys.map((k) => k.fixtureId))];
    // La double chance se lit sur le 1X2 du même book : on le relève aussi.
    const markets = [
      ...new Set([
        ...keys.map((k) => k.market),
        ...(keys.some((k) => k.market === 'DOUBLE_CHANCE')
          ? ['ONE_X_TWO']
          : []),
      ]),
    ];
    const wanted = new Set(keys.map(playableQuoteKey));
    const wantedGroups = new Set(
      keys.flatMap((k) => [
        `${k.fixtureId}|${k.market}`,
        ...(k.market === 'DOUBLE_CHANCE' ? [`${k.fixtureId}|ONE_X_TWO`] : []),
      ]),
    );

    const rows = await this.prisma.client.$queryRaw<
      {
        fixtureId: string;
        market: string;
        pick: string;
        bookmaker: string;
        odds: number;
        snapshotAt: Date;
      }[]
    >`
      WITH ${latestPrices({
        fixtureIds,
        markets,
        bookmakers: opts.operatorOnly ? OPERATOR_BOOKMAKERS : null,
        asOf: opts.asOf ?? null,
      })}
      SELECT latest."fixtureId"::text AS "fixtureId",
             latest.market::text      AS market,
             latest.pick,
             latest.bookmaker,
             latest.odds::float       AS odds,
             latest."snapshotAt"
      FROM latest
      WHERE latest.pick IS NOT NULL AND latest.odds IS NOT NULL
      UNION ALL
      -- Le 1X2 est relevé en triplet (pick NULL, trois colonnes) : une ligne
      -- par issue, comme pour la ligne de clôture.
      SELECT latest."fixtureId"::text, latest.market::text, side.pick,
             latest.bookmaker, side.odds::float, latest."snapshotAt"
      FROM latest
      CROSS JOIN LATERAL (VALUES ('HOME', latest."homeOdds"), ('DRAW', latest."drawOdds"), ('AWAY', latest."awayOdds"))
        AS side(pick, odds)
      WHERE latest.pick IS NULL AND side.odds IS NOT NULL
    `;

    // Les issues sœurs de chaque choix sont dans `rows` (même match, même
    // marché) : la marge du book des joueurs se calcule sans autre requête,
    // sur son seul prix — jamais en mélangeant les books.
    // Seules les issues du dernier relevé du book sur ce marché comptent :
    // une issue restée sur un ancien relevé donnerait une marge sur des prix
    // qui n'ont jamais coexisté (revue du lot 3).
    const operatorMargins = new Map<string, number>();
    const operatorFairs = new Map<string, number>();
    for (const bookmaker of OPERATOR_BOOKMAKERS) {
      const bookRows = rows.filter((row) => row.bookmaker === bookmaker);
      const lastSnapshot = new Map<string, number>();
      for (const row of bookRows) {
        const key = `${row.fixtureId}|${row.market}`;
        const at = new Date(row.snapshotAt).getTime();
        lastSnapshot.set(key, Math.max(lastSnapshot.get(key) ?? 0, at));
      }
      // Only the groups a wanted choice belongs to (and the 1X2 a double
      // chance is read on): pricing every group of the fixtures cost a
      // second on a page of « Matchs ».
      const current = bookRows.filter(
        (row) =>
          wantedGroups.has(`${row.fixtureId}|${row.market}`) &&
          new Date(row.snapshotAt).getTime() ===
            lastSnapshot.get(`${row.fixtureId}|${row.market}`),
      );
      for (const priced of priceOutcomeGroups(current)) {
        const key = playableQuoteKey(priced);
        if (!operatorMargins.has(key)) {
          operatorMargins.set(key, priced.margin.toNumber());
        }
      }
      for (const priced of shinOutcomeGroups(current)) {
        const key = playableQuoteKey(priced);
        if (!operatorFairs.has(key)) {
          operatorFairs.set(key, priced.fair.toDecimalPlaces(4).toNumber());
        }
      }
    }

    for (const row of rows) {
      const key = playableQuoteKey(row);
      if (!wanted.has(key)) continue;
      const current = result.get(key) ?? {
        fixtureId: row.fixtureId,
        market: row.market,
        pick: row.pick,
        operatorOdds: null,
        operatorBookmaker: null,
        operatorMargin: null,
        operatorFairProbability: null,
        lowestOdds: null,
        lowestBookmaker: null,
      };
      const operatorRank = OPERATOR_BOOKMAKERS.indexOf(row.bookmaker);
      if (
        operatorRank >= 0 &&
        (current.operatorBookmaker === null ||
          operatorRank < OPERATOR_BOOKMAKERS.indexOf(current.operatorBookmaker))
      ) {
        current.operatorOdds = row.odds;
        current.operatorBookmaker = row.bookmaker;
        current.operatorMargin = operatorMargins.get(key) ?? null;
        current.operatorFairProbability = operatorFairs.get(key) ?? null;
      }
      if (current.lowestOdds === null || row.odds < current.lowestOdds) {
        current.lowestOdds = row.odds;
        current.lowestBookmaker = row.bookmaker;
      }
      result.set(key, current);
    }
    return result;
  }

  /**
   * Marchés à ligne (corners) : dernier prix d'avant coup d'envoi de chaque
   * book sur la ligne demandée. La marge du book des joueurs se lit sur la
   * paire plus/moins de la même ligne, relevée au même instant (somme des
   * deux implicites − 1) ; inconnue si l'une des deux manque.
   */
  private async findLineQuotes(
    keys: readonly PlayableQuoteKey[],
    opts: { asOf?: Date },
  ): Promise<Map<string, PlayableQuote>> {
    const result = new Map<string, PlayableQuote>();
    if (keys.length === 0) return result;
    const fixtureIds = [...new Set(keys.map((k) => k.fixtureId))];
    const markets = [...new Set(keys.map((k) => k.market))];
    const lines = [...new Set(keys.map((k) => Number(k.line)))];
    const wanted = new Set(keys.map(playableQuoteKey));
    const rows = await this.prisma.client.$queryRaw<QuoteRow[]>`
      SELECT DISTINCT ON (o."fixtureId", o.market, o.line, o.pick, o.bookmaker)
             o."fixtureId"::text AS "fixtureId", o.market::text AS market,
             o.pick, o.line::float AS line, o.bookmaker,
             o.odds::float AS odds, o."snapshotAt"
      FROM public.odds_snapshot o
      JOIN public.fixture f ON f.id = o."fixtureId"
      WHERE o."fixtureId" = ANY(ARRAY[${Prisma.join(fixtureIds)}]::uuid[])
        AND o.market::text = ANY(ARRAY[${Prisma.join(markets)}]::text[])
        AND o.line = ANY(ARRAY[${Prisma.join(lines)}]::numeric[])
        AND o.odds IS NOT NULL
        AND o."snapshotAt" <= f."scheduledAt"
        ${opts.asOf ? Prisma.sql`AND coalesce(o."observedAt", o."snapshotAt") <= ${opts.asOf}` : Prisma.empty}
      ORDER BY o."fixtureId", o.market, o.line, o.pick, o.bookmaker, o."snapshotAt" DESC
    `;
    const rowAt = (row: QuoteRow) => new Date(row.snapshotAt).getTime();
    const pairKey = (row: QuoteRow, pick: string) =>
      `${row.bookmaker}|${row.fixtureId}|${row.market}|${row.line}|${pick}|${rowAt(row)}`;
    const byPair = new Map(rows.map((row) => [pairKey(row, row.pick), row]));
    for (const row of rows) {
      const key = playableQuoteKey(row);
      if (!wanted.has(key)) continue;
      const current = result.get(key) ?? {
        fixtureId: row.fixtureId,
        market: row.market,
        pick: row.pick,
        line: row.line,
        operatorOdds: null,
        operatorBookmaker: null,
        operatorMargin: null,
        operatorFairProbability: null,
        lowestOdds: null,
        lowestBookmaker: null,
      };
      if (OPERATOR_BOOKMAKERS.includes(row.bookmaker)) {
        const other = byPair.get(
          pairKey(row, row.pick === 'OVER' ? 'UNDER' : 'OVER'),
        );
        current.operatorOdds = row.odds;
        current.operatorBookmaker = row.bookmaker;
        current.operatorMargin = other
          ? new Decimal(1)
              .dividedBy(row.odds)
              .plus(new Decimal(1).dividedBy(other.odds))
              .minus(1)
              .toNumber()
          : null;
        // La paire plus/moins du même relevé, par Shin.
        current.operatorFairProbability = other
          ? (shinProbabilities([
              { pick: row.pick, odds: new Decimal(row.odds) },
              { pick: other.pick, odds: new Decimal(other.odds) },
            ])
              ?.get(row.pick)
              ?.toDecimalPlaces(4)
              .toNumber() ?? null)
          : null;
      }
      if (current.lowestOdds === null || row.odds < current.lowestOdds) {
        current.lowestOdds = row.odds;
        current.lowestBookmaker = row.bookmaker;
      }
      result.set(key, current);
    }
    return result;
  }
}
