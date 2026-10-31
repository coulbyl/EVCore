import { prematchCohortSql, vantageCohortSql } from '@evcore/db';
import { Injectable } from '@nestjs/common';
import {
  BetSource,
  BetStatus,
  ChannelDecisionStatus,
  FixtureStatus,
  NotificationType,
  type Prisma,
  StrategyChannel,
} from '@evcore/db';
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

  async getSummaryData(opts: {
    today: { start: Date; end: Date };
    yesterday: { start: Date; end: Date };
    pnlDateRange?: { start: Date; end: Date };
  }) {
    const { today, yesterday, pnlDateRange } = opts;
    const { start: todayStart, end: todayEnd } = today;
    const { start: yesterdayStart, end: yesterdayEnd } = yesterday;

    const [
      scheduledToday,
      scheduledYesterday,
      fixturesWithOddsToday,
      modelRunsToday,
      selectedDecisionsToday,
      unreadNotificationsTotal,
      unreadHighAlertsTotal,
      unreadNotifications,
      activityNotifications,
      latestFixture,
      latestOddsSnapshot,
      latestTeamStats,
      settledBets,
    ] = await Promise.all([
      this.prisma.client.fixture.count({
        where: {
          status: { in: [FixtureStatus.SCHEDULED, FixtureStatus.IN_PROGRESS] },
          scheduledAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      this.prisma.client.fixture.count({
        where: {
          status: { in: [FixtureStatus.SCHEDULED, FixtureStatus.IN_PROGRESS] },
          scheduledAt: { gte: yesterdayStart, lte: yesterdayEnd },
        },
      }),
      this.prisma.client.fixture.count({
        where: {
          status: { in: [FixtureStatus.SCHEDULED, FixtureStatus.IN_PROGRESS] },
          scheduledAt: { gte: todayStart, lte: todayEnd },
          oddsSnapshots: { some: {} },
        },
      }),
      this.prisma.client.modelRun.count({
        where: { analyzedAt: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.client.channelDecision.count({
        where: {
          status: ChannelDecisionStatus.SELECTED,
          modelRun: { analyzedAt: { gte: todayStart, lte: todayEnd } },
        },
      }),
      // userId: null — exclut les notifications personnelles (abonnements),
      // ce compteur ne couvre que les alertes admin/ops broadcast.
      this.prisma.client.notification.count({
        where: { read: false, userId: null },
      }),
      this.prisma.client.notification.count({
        where: {
          read: false,
          type: {
            in: [
              NotificationType.ETL_FAILURE,
              NotificationType.MARKET_SUSPENSION,
            ],
          },
        },
      }),
      this.prisma.client.notification.findMany({
        where: {
          read: false,
          type: {
            in: [
              NotificationType.ETL_FAILURE,
              NotificationType.MARKET_SUSPENSION,
              NotificationType.ROI_ALERT,
              NotificationType.BRIER_ALERT,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      this.prisma.client.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.client.fixture.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
      this.prisma.client.oddsSnapshot.findFirst({
        orderBy: { snapshotAt: 'desc' },
        select: { snapshotAt: true },
      }),
      this.prisma.client.teamStats.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.client.bet.findMany({
        where: {
          status: { in: [BetStatus.WON, BetStatus.LOST] },
          ...(pnlDateRange
            ? {
                modelRun: {
                  fixture: {
                    scheduledAt: {
                      gte: pnlDateRange.start,
                      lte: pnlDateRange.end,
                    },
                  },
                },
              }
            : {}),
        },
        select: {
          status: true,
          stakePct: true,
          oddsSnapshot: true,
        },
      }),
    ]);

    return {
      scheduledToday,
      scheduledYesterday,
      fixturesWithOddsToday,
      modelRunsToday,
      selectedDecisionsToday,
      unreadNotificationsTotal,
      unreadHighAlertsTotal,
      unreadNotifications,
      activityNotifications,
      latestFixture,
      latestOddsSnapshot,
      latestTeamStats,
      settledBets,
    };
  }

  getCompetitionData(since: Date, canal?: 'VALUE' | 'SAFE') {
    const fixtureFilter = { scheduledAt: { gte: since } };
    const competitionSelect = {
      select: { id: true, name: true, code: true },
    } as const;
    const seasonSelect = {
      select: { competition: competitionSelect },
    } as const;
    const canalFilter =
      canal === 'VALUE'
        ? {
            channelSelection: {
              is: {
                channelDecision: { is: { channel: StrategyChannel.VALUE } },
              },
            },
          }
        : canal === 'SAFE'
          ? {
              channelSelection: {
                is: {
                  channelDecision: { is: { channel: StrategyChannel.SAFE } },
                },
              },
            }
          : {};

    return Promise.all([
      // Fixtures analysées par compétition (30 derniers jours)
      this.prisma.client.modelRun.findMany({
        where: { fixture: fixtureFilter },
        distinct: ['fixtureId'],
        select: {
          fixture: { select: { season: seasonSelect } },
        },
      }),
      // Bets MODEL settlés par compétition
      this.prisma.client.bet.findMany({
        where: {
          source: BetSource.MODEL,
          status: { in: [BetStatus.WON, BetStatus.LOST] },
          fixture: fixtureFilter,
          oddsSnapshot: { not: null },
          ...canalFilter,
        },
        select: {
          status: true,
          probEstimated: true,
          fixture: { select: { season: seasonSelect } },
        },
      }),
    ]);
  }

  // Scoped to the dashboard's period filter (fixture.scheduledAt) instead of
  // an unrelated "last 200 ever" window.
  findModelBetsInRange(
    channel: StrategyChannel,
    range: { since: Date; until: Date },
  ) {
    return this.prisma.client.bet.findMany({
      where: {
        status: { in: [BetStatus.WON, BetStatus.LOST] },
        source: BetSource.MODEL,
        channelSelection: {
          is: { channelDecision: { is: { channel } } },
        },
        oddsSnapshot: { not: null },
        modelRun: {
          is: {
            fixture: {
              is: { scheduledAt: { gte: range.since, lte: range.until } },
            },
          },
        },
      },
      select: {
        status: true,
        oddsSnapshot: true,
        stakePct: true,
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
      orderBy: { createdAt: 'desc' },
    });
  }

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
