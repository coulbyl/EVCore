import { prematchCohortSql, vantageCohortSql } from '@evcore/db';
import { Injectable } from '@nestjs/common';
import { BetStatus, type Prisma, StrategyChannel } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

// PostgreSQL rejects prepared statements with too many bind parameters. The
// point-in-time cohort can contain tens of thousands of selections on the
// all-history dashboard range, so never feed the complete id list to one
// Prisma `in` filter. 10k leaves ample room for the other query parameters.
const CHANNEL_SELECTION_QUERY_BATCH_SIZE = 10_000;
const CHANNEL_SELECTION_DASHBOARD_SELECT = {
  result: true,
  odds: true,
  probability: true,
  market: true,
  marginPaid: true,
  channelDecision: {
    select: {
      channel: true,
      modelRun: {
        select: {
          fixture: {
            select: {
              season: {
                select: {
                  competition: {
                    select: { code: true, name: true, country: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ChannelSelectionSelect;

type DashboardChannelSelection = Prisma.ChannelSelectionGetPayload<{
  select: typeof CHANNEL_SELECTION_DASHBOARD_SELECT;
}>;

/** Un avis VANTAGE compté, avec sa version de prompt et son coup d'envoi. */
export type VantageCohortRow = {
  selection: DashboardChannelSelection;
  configVersion: string | null;
  kickoff: Date;
};

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  // DOMINANT/BTTS/DRAW/GOALS never materialise a Bet (analytical-only channels —
  // see BetSettlementService docblock), so their settled record lives on
  // ChannelSelection.result directly instead of the bet table.
  /**
   * Sélections réglées de PLUSIEURS canaux, en une seule requête.
   *
   * Une requête par canal auparavant, lancées en parallèle par `Promise.all`.
   * Tenable à 10 canaux, plus du tout à 18 : les workers parallèles de
   * Postgres réclament chacun un segment de mémoire partagée, et le conteneur
   * n'a que les 64 Mo de `/dev/shm` par défaut. Trois endpoints × 18 requêtes
   * lourdes en simultané faisaient tomber la page entière sur
   * « could not resize shared memory segment » (SQLSTATE 53100), sur la
   * période « tout l'historique ».
   *
   * Le canal remonte dans le résultat pour que l'appelant regroupe en
   * mémoire — bien moins cher qu'un aller-retour par canal.
   */
  async findChannelSelectionsInRange(
    channels: readonly StrategyChannel[],
    range: { since: Date; until: Date },
  ) {
    const cohort = await this.prisma.client.$queryRaw<{ id: string }[]>(
      prematchCohortSql({
        asOf: new Date(),
        since: range.since,
        until: range.until,
      }),
    );
    const selectionIds = cohort.map((row) => row.id);
    const selections: DashboardChannelSelection[] = [];

    // Sequential on purpose: this query used to exhaust PostgreSQL shared
    // memory when many channel queries ran concurrently. Batching fixes the
    // parameter ceiling without reintroducing that production failure mode.
    for (
      let offset = 0;
      offset < selectionIds.length;
      offset += CHANNEL_SELECTION_QUERY_BATCH_SIZE
    ) {
      const ids = selectionIds.slice(
        offset,
        offset + CHANNEL_SELECTION_QUERY_BATCH_SIZE,
      );
      const batch = await this.prisma.client.channelSelection.findMany({
        where: {
          id: { in: ids },
          result: { in: [BetStatus.WON, BetStatus.LOST] },
          odds: { not: null },
          channelDecision: {
            is: {
              channel: { in: [...channels] },
              modelRun: {
                is: {
                  fixture: {
                    is: {
                      scheduledAt: { gte: range.since, lte: range.until },
                    },
                  },
                },
              },
            },
          },
        },
        select: CHANNEL_SELECTION_DASHBOARD_SELECT,
        orderBy: { createdAt: 'desc' },
      });
      selections.push(...batch);
    }

    if (channels.includes(StrategyChannel.VANTAGE)) {
      const vantage = await this.findVantageCohortRows(range);
      selections.push(...vantage.map((row) => row.selection));
    }
    return selections;
  }

  /**
   * Avis VANTAGE comptés, lus sur l'historique figé (vantageCohortSql) et
   * mis à la forme d'une sélection : la ligne vivante, réécrite par upsert
   * et parfois après le coup d'envoi, n'entre dans aucun bilan (2026-10-29).
   */
  async findVantageCohortRows(range: {
    since: Date;
    until: Date;
  }): Promise<VantageCohortRow[]> {
    const cohort = await this.prisma.client.$queryRaw<{ id: string }[]>(
      vantageCohortSql({
        asOf: new Date(),
        since: range.since,
        until: range.until,
      }),
    );
    const rows: VantageCohortRow[] = [];
    for (
      let offset = 0;
      offset < cohort.length;
      offset += CHANNEL_SELECTION_QUERY_BATCH_SIZE
    ) {
      const ids = cohort
        .slice(offset, offset + CHANNEL_SELECTION_QUERY_BATCH_SIZE)
        .map((row) => row.id);
      const batch = await this.prisma.client.vantageDecisionHistory.findMany({
        where: {
          id: { in: ids },
          result: { in: [BetStatus.WON, BetStatus.LOST] },
          odds: { not: null },
          market: { not: null },
        },
        select: {
          result: true,
          odds: true,
          probability: true,
          market: true,
          marginPaid: true,
          configVersion: true,
          fixture: {
            select: {
              scheduledAt: true,
              season: {
                select: {
                  competition: {
                    select: { code: true, name: true, country: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      for (const row of batch) {
        if (row.market === null || row.probability === null) continue;
        rows.push({
          configVersion: row.configVersion,
          kickoff: row.fixture.scheduledAt,
          selection: {
            result: row.result,
            odds: row.odds,
            probability: row.probability,
            market: row.market,
            marginPaid: row.marginPaid,
            channelDecision: {
              channel: StrategyChannel.VANTAGE,
              modelRun: { fixture: { season: row.fixture.season } },
            },
          },
        });
      }
    }
    return rows;
  }
}
