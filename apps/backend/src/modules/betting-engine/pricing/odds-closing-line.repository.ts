import { Injectable } from '@nestjs/common';
import { Prisma, type Market } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import type { ClosingLineRow } from './closing-line';

/**
 * Lecture de la vue `odds_closing_line` : dernier prix observé AVANT le coup
 * d'envoi par (rencontre, book, marché, choix). Un seul lecteur pour les deux
 * règlements (jambes de coupon, sélections de canal), afin que « clôture »
 * veuille dire la même chose partout.
 */
@Injectable()
export class OddsClosingLineRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lignes de clôture des rencontres et marchés demandés, assez fraîches pour
   * servir au CLV (chantier E, E-2).
   *
   * Ne garde que les observations à moins de `maxHoursBeforeKickoff` : la
   * vue expose cette distance précisément pour qu'aucun consommateur ne
   * prenne un relevé de la veille pour une clôture. Le 1X2 est stocké en une
   * ligne à trois colonnes : il est déplié ici en trois choix pour que le
   * groupe d'issues se lise comme les autres marchés. Les marchés à `line`
   * (handicap, corners) sont exclus : leur identité ne tient pas dans `pick`.
   */
  async findClosingLines(opts: {
    fixtureIds: readonly string[];
    markets: readonly Market[];
    maxHoursBeforeKickoff: number;
  }): Promise<readonly ClosingLineRow[]> {
    if (opts.fixtureIds.length === 0 || opts.markets.length === 0) return [];
    return this.prisma.client.$queryRaw<ClosingLineRow[]>`
      WITH closing AS (
        SELECT c."fixtureId", c.bookmaker, c.market, c.pick, c.odds,
               c."homeOdds", c."drawOdds", c."awayOdds",
               -- Heure d'observation déduite de la distance au coup d'envoi :
               -- observedAt une fois la migration 20261005220000 passée,
               -- snapshotAt avant, sans dépendre de la version de la vue.
               f."scheduledAt" - make_interval(secs => c."hoursBeforeKickoff" * 3600)
                 AS "observedAt"
        FROM public.odds_closing_line c
        JOIN fixture f ON f.id = c."fixtureId"
        WHERE c."fixtureId" = ANY(ARRAY[${Prisma.join([...opts.fixtureIds])}]::uuid[])
          AND c.market::text = ANY(ARRAY[${Prisma.join([...opts.markets])}]::text[])
          AND c.line IS NULL
          AND c."hoursBeforeKickoff" <= ${opts.maxHoursBeforeKickoff}
      )
      SELECT closing."fixtureId"::text       AS "fixtureId",
             closing.bookmaker,
             closing.market::text            AS market,
             closing.pick,
             closing.odds::float             AS odds,
             closing."observedAt"
      FROM closing
      WHERE closing.pick IS NOT NULL AND closing.odds IS NOT NULL
      UNION ALL
      SELECT closing."fixtureId"::text, closing.bookmaker, closing.market::text,
             side.pick, side.odds::float, closing."observedAt"
      FROM closing
      CROSS JOIN LATERAL (VALUES ('HOME', closing."homeOdds"), ('DRAW', closing."drawOdds"), ('AWAY', closing."awayOdds"))
        AS side(pick, odds)
      WHERE closing.pick IS NULL AND side.odds IS NOT NULL
    `;
  }
}
