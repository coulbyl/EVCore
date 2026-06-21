import { Injectable } from '@nestjs/common';
import { BetStatus, FixtureStatus, Prisma, StrategyChannel } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

/** One settled channel selection, localised by competition/season. */
export type SettledChannelRow = {
  channel: StrategyChannel;
  competitionCode: string;
  competitionName: string;
  seasonName: string;
  probability: Prisma.Decimal;
  ev: Prisma.Decimal | null;
  odds: Prisma.Decimal | null;
  won: boolean;
};

/** One finished fixture's model 1X2 probabilities + realised outcome. */
export type ModelProbabilityRow = {
  competitionCode: string;
  competitionName: string;
  seasonName: string;
  features: Prisma.JsonValue;
  homeScore: number;
  awayScore: number;
};

/**
 * DB reads for the redesigned, per-channel backtest. Everything is sourced from
 * the engine's own outputs (`channel_selection`, `model_run.features`) — the
 * backtest never re-implements scoring.
 */
@Injectable()
export class BacktestRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Settled channel selections in a date window, optionally one competition. */
  async findSettledChannelRows(opts: {
    from: Date;
    to: Date;
    competitionCode?: string;
  }): Promise<SettledChannelRow[]> {
    const { from, to, competitionCode } = opts;
    const rows = await this.prisma.client.channelSelection.findMany({
      where: {
        result: { in: [BetStatus.WON, BetStatus.LOST] },
        channelDecision: {
          is: {
            modelRun: {
              is: {
                fixture: {
                  is: {
                    scheduledAt: { gte: from, lte: to },
                    ...(competitionCode
                      ? { season: { competition: { code: competitionCode } } }
                      : {}),
                  },
                },
              },
            },
          },
        },
      },
      select: {
        probability: true,
        ev: true,
        odds: true,
        result: true,
        channelDecision: {
          select: {
            channel: true,
            modelRun: {
              select: {
                fixture: {
                  select: {
                    season: {
                      select: {
                        name: true,
                        competition: { select: { code: true, name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return rows.map((r) => {
      const season = r.channelDecision.modelRun.fixture.season;
      return {
        channel: r.channelDecision.channel,
        competitionCode: season.competition.code,
        competitionName: season.competition.name,
        seasonName: season.name,
        probability: r.probability,
        ev: r.ev,
        odds: r.odds,
        won: r.result === BetStatus.WON,
      };
    });
  }

  /**
   * Latest model run per finished fixture in a window, with its feature snapshot
   * (probabilities) and realised score — feeds Brier/ECE model calibration.
   */
  async findModelProbabilityRows(opts: {
    from: Date;
    to: Date;
    competitionCode?: string;
  }): Promise<ModelProbabilityRow[]> {
    const { from, to, competitionCode } = opts;
    const fixtures = await this.prisma.client.fixture.findMany({
      where: {
        status: FixtureStatus.FINISHED,
        homeScore: { not: null },
        awayScore: { not: null },
        scheduledAt: { gte: from, lte: to },
        ...(competitionCode
          ? { season: { competition: { code: competitionCode } } }
          : {}),
      },
      select: {
        homeScore: true,
        awayScore: true,
        season: {
          select: {
            name: true,
            competition: { select: { code: true, name: true } },
          },
        },
        modelRuns: {
          select: { features: true },
          orderBy: { analyzedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    });

    const rows: ModelProbabilityRow[] = [];
    for (const f of fixtures) {
      const run = f.modelRuns[0];
      if (!run || f.homeScore === null || f.awayScore === null) continue;
      rows.push({
        competitionCode: f.season.competition.code,
        competitionName: f.season.competition.name,
        seasonName: f.season.name,
        features: run.features,
        homeScore: f.homeScore,
        awayScore: f.awayScore,
      });
    }
    return rows;
  }
}
