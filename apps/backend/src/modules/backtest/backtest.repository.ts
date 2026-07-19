import { Injectable } from '@nestjs/common';
import {
  BetStatus,
  FixtureStatus,
  Market,
  Prisma,
  StrategyChannel,
} from '@evcore/db';
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
 * One finished fixture's tuning inputs: the channel signals (from the model
 * feature snapshot), the latest prematch odds, and the realised score. Feeds
 * the offline threshold sweep — every config channel's selection is recoverable
 * from this row at any candidate threshold without re-running the engine.
 */
export type ChannelTuningRow = {
  competitionCode: string;
  competitionName: string;
  homeScore: number;
  awayScore: number;
  // Half-time scores — only WIN_EITHER_HALF's outcome needs them; null when
  // the fixture has no recorded HT score (pre-live-sync history).
  homeHtScore: number | null;
  awayHtScore: number | null;
  probHome: number;
  probDraw: number;
  probAway: number;
  probBttsYes: number | null;
  probBttsNo: number | null;
  // GOALS (Over/Under 2.5) — the only line with usable odds coverage in history.
  probOver25: number | null;
  probUnder25: number | null;
  // CLEAN_SHEET / WIN_EITHER_HALF — forward-only odds coverage (PREMATCH sync,
  // started 2026-07-18), see CLEAN_SHEET_CONFIG/WIN_EITHER_HALF_CONFIG header.
  probCleanSheetHome: number | null;
  probCleanSheetAway: number | null;
  probWinEitherHalfHome: number | null;
  probWinEitherHalfAway: number | null;
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  oddsBttsYes: number | null;
  oddsBttsNo: number | null;
  oddsOver25: number | null;
  oddsUnder25: number | null;
  oddsCleanSheetHome: number | null;
  oddsCleanSheetAway: number | null;
  oddsWinEitherHalfHome: number | null;
  oddsWinEitherHalfAway: number | null;
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

  /**
   * Per-finished-fixture tuning inputs: model signals (1X2 + BTTS) from the
   * latest run's feature snapshot, latest prematch odds (1X2 + BTTS YES), and
   * the realised score. The odds use the most recent snapshot per market — an
   * offline approximation of the live "best bookmaker" selection, good enough
   * to rank candidate thresholds.
   */
  async findChannelTuningRows(opts: {
    from: Date;
    to: Date;
    competitionCode?: string;
  }): Promise<ChannelTuningRow[]> {
    const { from, to, competitionCode } = opts;
    const fixtureWhere = {
      status: FixtureStatus.FINISHED,
      homeScore: { not: null },
      awayScore: { not: null },
      scheduledAt: { gte: from, lte: to },
      ...(competitionCode
        ? { season: { competition: { code: competitionCode } } }
        : {}),
    } satisfies Prisma.FixtureWhereInput;

    const fixtures = await this.prisma.client.fixture.findMany({
      where: fixtureWhere,
      select: {
        id: true,
        homeScore: true,
        awayScore: true,
        homeHtScore: true,
        awayHtScore: true,
        season: {
          select: { competition: { select: { code: true, name: true } } },
        },
        modelRuns: {
          select: { features: true },
          orderBy: { analyzedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    });

    const oneXTwoByFixture = await this.latestOneXTwoOdds(to, fixtureWhere);
    const bttsYesByFixture = await this.latestBttsOdds(to, fixtureWhere, 'YES');
    const bttsNoByFixture = await this.latestBttsOdds(to, fixtureWhere, 'NO');
    const overByFixture = await this.latestOverUnderOdds(
      to,
      fixtureWhere,
      'OVER',
    );
    const underByFixture = await this.latestOverUnderOdds(
      to,
      fixtureWhere,
      'UNDER',
    );
    const cleanSheetHomeByFixture = await this.latestSimpleOdds({
      to,
      fixtureWhere,
      market: Market.CLEAN_SHEET_HOME,
      pick: 'YES',
    });
    const cleanSheetAwayByFixture = await this.latestSimpleOdds({
      to,
      fixtureWhere,
      market: Market.CLEAN_SHEET_AWAY,
      pick: 'YES',
    });
    const winEitherHalfHomeByFixture = await this.latestSimpleOdds({
      to,
      fixtureWhere,
      market: Market.TO_WIN_EITHER_HALF,
      pick: 'HOME',
    });
    const winEitherHalfAwayByFixture = await this.latestSimpleOdds({
      to,
      fixtureWhere,
      market: Market.TO_WIN_EITHER_HALF,
      pick: 'AWAY',
    });

    const rows: ChannelTuningRow[] = [];
    for (const f of fixtures) {
      const run = f.modelRuns[0];
      if (!run || f.homeScore === null || f.awayScore === null) continue;
      const probs = readSignalProbabilities(run.features);
      if (!probs) continue;
      const oneXTwo = oneXTwoByFixture.get(f.id) ?? null;
      rows.push({
        competitionCode: f.season.competition.code,
        competitionName: f.season.competition.name,
        homeScore: f.homeScore,
        awayScore: f.awayScore,
        homeHtScore: f.homeHtScore,
        awayHtScore: f.awayHtScore,
        probHome: probs.home,
        probDraw: probs.draw,
        probAway: probs.away,
        probBttsYes: probs.bttsYes,
        probBttsNo: probs.bttsNo,
        probOver25: probs.over25,
        probUnder25: probs.under25,
        probCleanSheetHome: probs.cleanSheetHome,
        probCleanSheetAway: probs.cleanSheetAway,
        probWinEitherHalfHome: probs.winEitherHalfHome,
        probWinEitherHalfAway: probs.winEitherHalfAway,
        oddsHome: oneXTwo?.home ?? null,
        oddsDraw: oneXTwo?.draw ?? null,
        oddsAway: oneXTwo?.away ?? null,
        oddsBttsYes: bttsYesByFixture.get(f.id) ?? null,
        oddsBttsNo: bttsNoByFixture.get(f.id) ?? null,
        oddsOver25: overByFixture.get(f.id) ?? null,
        oddsUnder25: underByFixture.get(f.id) ?? null,
        oddsCleanSheetHome: cleanSheetHomeByFixture.get(f.id) ?? null,
        oddsCleanSheetAway: cleanSheetAwayByFixture.get(f.id) ?? null,
        oddsWinEitherHalfHome: winEitherHalfHomeByFixture.get(f.id) ?? null,
        oddsWinEitherHalfAway: winEitherHalfAwayByFixture.get(f.id) ?? null,
      });
    }
    return rows;
  }

  /** Latest Over/Under 2.5 odds (one side) per fixture in the window. */
  private async latestOverUnderOdds(
    to: Date,
    fixtureWhere: Prisma.FixtureWhereInput,
    pick: 'OVER' | 'UNDER',
  ): Promise<Map<string, number>> {
    const snapshots = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        market: Market.OVER_UNDER,
        pick,
        odds: { not: null },
        snapshotAt: { lte: to },
        fixture: { is: fixtureWhere },
      },
      select: { fixtureId: true, odds: true },
      orderBy: [{ fixtureId: 'asc' }, { snapshotAt: 'desc' }],
    });
    const byFixture = new Map<string, number>();
    for (const s of snapshots) {
      if (byFixture.has(s.fixtureId) || s.odds === null) continue;
      byFixture.set(s.fixtureId, Number(s.odds));
    }
    return byFixture;
  }

  /** Latest full 1X2 snapshot per fixture in the window (most recent first). */
  private async latestOneXTwoOdds(
    to: Date,
    fixtureWhere: Prisma.FixtureWhereInput,
  ): Promise<Map<string, { home: number; draw: number; away: number }>> {
    const snapshots = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        market: Market.ONE_X_TWO,
        homeOdds: { not: null },
        drawOdds: { not: null },
        awayOdds: { not: null },
        snapshotAt: { lte: to },
        fixture: { is: fixtureWhere },
      },
      select: {
        fixtureId: true,
        homeOdds: true,
        drawOdds: true,
        awayOdds: true,
      },
      orderBy: [{ fixtureId: 'asc' }, { snapshotAt: 'desc' }],
    });
    const byFixture = new Map<
      string,
      { home: number; draw: number; away: number }
    >();
    for (const s of snapshots) {
      if (byFixture.has(s.fixtureId)) continue;
      if (s.homeOdds === null || s.drawOdds === null || s.awayOdds === null) {
        continue;
      }
      byFixture.set(s.fixtureId, {
        home: Number(s.homeOdds),
        draw: Number(s.drawOdds),
        away: Number(s.awayOdds),
      });
    }
    return byFixture;
  }

  /** Latest BTTS odds (one side) per fixture in the window. */
  private async latestBttsOdds(
    to: Date,
    fixtureWhere: Prisma.FixtureWhereInput,
    pick: 'YES' | 'NO',
  ): Promise<Map<string, number>> {
    const snapshots = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        market: Market.BTTS,
        pick,
        odds: { not: null },
        snapshotAt: { lte: to },
        fixture: { is: fixtureWhere },
      },
      select: { fixtureId: true, odds: true },
      orderBy: [{ fixtureId: 'asc' }, { snapshotAt: 'desc' }],
    });
    const byFixture = new Map<string, number>();
    for (const s of snapshots) {
      if (byFixture.has(s.fixtureId) || s.odds === null) continue;
      byFixture.set(s.fixtureId, Number(s.odds));
    }
    return byFixture;
  }

  /** Latest odds for a single (market, pick) per fixture in the window —
   * generic version of latestBttsOdds/latestOverUnderOdds for markets that
   * only ever need one side's price (CLEAN_SHEET_*, TO_WIN_EITHER_HALF). */
  private async latestSimpleOdds(opts: {
    to: Date;
    fixtureWhere: Prisma.FixtureWhereInput;
    market: Market;
    pick: string;
  }): Promise<Map<string, number>> {
    const { to, fixtureWhere, market, pick } = opts;
    const snapshots = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        market,
        pick,
        odds: { not: null },
        snapshotAt: { lte: to },
        fixture: { is: fixtureWhere },
      },
      select: { fixtureId: true, odds: true },
      orderBy: [{ fixtureId: 'asc' }, { snapshotAt: 'desc' }],
    });
    const byFixture = new Map<string, number>();
    for (const s of snapshots) {
      if (byFixture.has(s.fixtureId) || s.odds === null) continue;
      byFixture.set(s.fixtureId, Number(s.odds));
    }
    return byFixture;
  }
}

/** Reads the 1X2 + BTTS + Over/Under 2.5 + CLEAN_SHEET/WIN_EITHER_HALF
 * probabilities from a feature snapshot. */
function readSignalProbabilities(features: Prisma.JsonValue): {
  home: number;
  draw: number;
  away: number;
  bttsYes: number | null;
  bttsNo: number | null;
  over25: number | null;
  under25: number | null;
  cleanSheetHome: number | null;
  cleanSheetAway: number | null;
  winEitherHalfHome: number | null;
  winEitherHalfAway: number | null;
} | null {
  if (!features || typeof features !== 'object' || Array.isArray(features)) {
    return null;
  }
  const probs = (features as Record<string, unknown>)['probabilities'];
  if (!probs || typeof probs !== 'object') return null;
  const p = probs as Record<string, unknown>;
  const home = p['home'];
  const draw = p['draw'];
  const away = p['away'];
  const bttsYes = p['bttsYes'];
  const bttsNo = p['bttsNo'];
  const over25 = p['over25'];
  const under25 = p['under25'];
  const cleanSheetHome = p['cleanSheetHome'];
  const cleanSheetAway = p['cleanSheetAway'];
  const winEitherHalfHome = p['winEitherHalfHome'];
  const winEitherHalfAway = p['winEitherHalfAway'];
  if (
    typeof home !== 'number' ||
    typeof draw !== 'number' ||
    typeof away !== 'number'
  ) {
    return null;
  }
  // P(NO) is mutually exclusive/exhaustive with P(YES); fall back to 1 − YES
  // when an older snapshot only stored the YES side.
  const resolvedBttsNo =
    typeof bttsNo === 'number'
      ? bttsNo
      : typeof bttsYes === 'number'
        ? 1 - bttsYes
        : null;
  return {
    home,
    draw,
    away,
    bttsYes: typeof bttsYes === 'number' ? bttsYes : null,
    bttsNo: resolvedBttsNo,
    over25: typeof over25 === 'number' ? over25 : null,
    under25: typeof under25 === 'number' ? under25 : null,
    cleanSheetHome: typeof cleanSheetHome === 'number' ? cleanSheetHome : null,
    cleanSheetAway: typeof cleanSheetAway === 'number' ? cleanSheetAway : null,
    winEitherHalfHome:
      typeof winEitherHalfHome === 'number' ? winEitherHalfHome : null,
    winEitherHalfAway:
      typeof winEitherHalfAway === 'number' ? winEitherHalfAway : null,
  };
}
