import { Injectable } from '@nestjs/common';
import { Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { OPERATOR_BOOKMAKERS, priceOutcomeGroups } from '@evcore/analysis-core';

export type PlayableQuoteKey = {
  fixtureId: string;
  market: string;
  pick: string;
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
  /** Prix le plus bas de tous les books relevés (le pire cas). */
  lowestOdds: number | null;
  lowestBookmaker: string | null;
};

export function playableQuoteKey(key: PlayableQuoteKey): string {
  return `${key.fixtureId}|${key.market}|${key.pick}`;
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
    opts: { asOf?: Date } = {},
  ): Promise<Map<string, PlayableQuote>> {
    const result = new Map<string, PlayableQuote>();
    if (keys.length === 0) return result;
    const fixtureIds = [...new Set(keys.map((k) => k.fixtureId))];
    const markets = [...new Set(keys.map((k) => k.market))];
    const wanted = new Set(keys.map(playableQuoteKey));

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
      WITH latest AS (
        SELECT DISTINCT ON (o."fixtureId", o.market, o.pick, o.bookmaker)
               o."fixtureId", o.market, o.pick, o.bookmaker, o.odds,
               o."homeOdds", o."drawOdds", o."awayOdds", o."snapshotAt"
        FROM public.odds_snapshot o
        JOIN public.fixture f ON f.id = o."fixtureId"
        WHERE o."fixtureId" = ANY(ARRAY[${Prisma.join(fixtureIds)}]::uuid[])
          AND o.market::text = ANY(ARRAY[${Prisma.join(markets)}]::text[])
          AND o.line IS NULL
          AND o."snapshotAt" <= f."scheduledAt"
          ${opts.asOf ? Prisma.sql`AND coalesce(o."observedAt", o."snapshotAt") <= ${opts.asOf}` : Prisma.empty}
        ORDER BY o."fixtureId", o.market, o.pick, o.bookmaker, o."snapshotAt" DESC
      )
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
    for (const bookmaker of OPERATOR_BOOKMAKERS) {
      const bookRows = rows.filter((row) => row.bookmaker === bookmaker);
      const lastSnapshot = new Map<string, number>();
      for (const row of bookRows) {
        const key = `${row.fixtureId}|${row.market}`;
        const at = new Date(row.snapshotAt).getTime();
        lastSnapshot.set(key, Math.max(lastSnapshot.get(key) ?? 0, at));
      }
      const current = bookRows.filter(
        (row) =>
          new Date(row.snapshotAt).getTime() ===
          lastSnapshot.get(`${row.fixtureId}|${row.market}`),
      );
      for (const priced of priceOutcomeGroups(current)) {
        const key = playableQuoteKey(priced);
        if (!operatorMargins.has(key)) {
          operatorMargins.set(key, priced.margin.toNumber());
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
