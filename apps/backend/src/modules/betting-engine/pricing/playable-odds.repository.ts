import { Injectable } from '@nestjs/common';
import { Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { OPERATOR_BOOKMAKERS } from './playable-odds.constants';

export type PlayableQuoteKey = {
  fixtureId: string;
  market: string;
  pick: string;
};

export type PlayableQuote = PlayableQuoteKey & {
  /** Prix chez le book de l'utilisateur quand il cote le choix, sinon null. */
  operatorOdds: number | null;
  operatorBookmaker: string | null;
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

  async findPlayableQuotes(
    keys: readonly PlayableQuoteKey[],
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
      }[]
    >`
      WITH latest AS (
        SELECT DISTINCT ON (o."fixtureId", o.market, o.pick, o.bookmaker)
               o."fixtureId", o.market, o.pick, o.bookmaker, o.odds,
               o."homeOdds", o."drawOdds", o."awayOdds"
        FROM public.odds_snapshot o
        JOIN public.fixture f ON f.id = o."fixtureId"
        WHERE o."fixtureId" = ANY(ARRAY[${Prisma.join(fixtureIds)}]::uuid[])
          AND o.market::text = ANY(ARRAY[${Prisma.join(markets)}]::text[])
          AND o.line IS NULL
          AND o."snapshotAt" <= f."scheduledAt"
        ORDER BY o."fixtureId", o.market, o.pick, o.bookmaker, o."snapshotAt" DESC
      )
      SELECT latest."fixtureId"::text AS "fixtureId",
             latest.market::text      AS market,
             latest.pick,
             latest.bookmaker,
             latest.odds::float       AS odds
      FROM latest
      WHERE latest.pick IS NOT NULL AND latest.odds IS NOT NULL
      UNION ALL
      -- Le 1X2 est relevé en triplet (pick NULL, trois colonnes) : une ligne
      -- par issue, comme pour la ligne de clôture.
      SELECT latest."fixtureId"::text, latest.market::text, side.pick,
             latest.bookmaker, side.odds::float
      FROM latest
      CROSS JOIN LATERAL (VALUES ('HOME', latest."homeOdds"), ('DRAW', latest."drawOdds"), ('AWAY', latest."awayOdds"))
        AS side(pick, odds)
      WHERE latest.pick IS NULL AND side.odds IS NOT NULL
    `;

    for (const row of rows) {
      const key = playableQuoteKey(row);
      if (!wanted.has(key)) continue;
      const current = result.get(key) ?? {
        fixtureId: row.fixtureId,
        market: row.market,
        pick: row.pick,
        operatorOdds: null,
        operatorBookmaker: null,
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
