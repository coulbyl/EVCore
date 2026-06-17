import {
  BetSource,
  BetStatus,
  ChannelDecisionStatus,
  Decision,
  FixtureStatus,
  Market,
  PredictionChannel,
  StrategyChannel,
  prisma,
} from '@evcore/db';
import {
  runBackfill,
  type BackfillArgs,
} from '@/scripts/backfill-channel-decisions.lib';
import { truncateAllTables } from './setup/prisma-test';

const FULL_RUN: BackfillArgs = {
  from: null,
  to: null,
  limit: null,
  batchSize: 500,
  dryRun: false,
};

describe('Backfill channel decisions (e2e)', () => {
  let counter = 1;

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('backfills EV/SAFE from bets, DOMINANT/DRAW/BTTS from predictions, links bets', async () => {
    const { runId, evBetId, safeBetId, userBetId } = await seedSelectedRun();

    const stats = await runBackfill({ db: prisma, args: FULL_RUN });
    expect(stats.evSelected).toBe(1);
    expect(stats.safeSelected).toBe(1);
    expect(stats.predictionSelected).toBe(3);
    expect(stats.evRejected).toBe(0);
    expect(stats.betsLinked).toBe(2);

    const decisions = await prisma.channelDecision.findMany({
      where: { modelRunId: runId },
      select: { channel: true, status: true, selections: true },
      orderBy: { channel: 'asc' },
    });
    const byChannel = new Map(decisions.map((d) => [d.channel, d]));

    expect(byChannel.get(StrategyChannel.EV)?.status).toBe(
      ChannelDecisionStatus.SELECTED,
    );
    expect(byChannel.get(StrategyChannel.SAFE)?.status).toBe(
      ChannelDecisionStatus.SELECTED,
    );
    expect(byChannel.get(StrategyChannel.DOMINANT)?.selections[0]?.pick).toBe(
      'HOME',
    );
    expect(byChannel.get(StrategyChannel.DOMINANT)?.selections[0]?.result).toBe(
      BetStatus.WON,
    );
    expect(byChannel.get(StrategyChannel.DRAW)?.selections[0]?.result).toBe(
      BetStatus.LOST,
    );
    expect(
      byChannel.get(StrategyChannel.BTTS)?.selections[0]?.result,
    ).toBeNull();

    // EV/SAFE bets linked to their selection; USER bet untouched.
    const evBet = await prisma.bet.findUniqueOrThrow({
      where: { id: evBetId },
    });
    const safeBet = await prisma.bet.findUniqueOrThrow({
      where: { id: safeBetId },
    });
    const userBet = await prisma.bet.findUniqueOrThrow({
      where: { id: userBetId },
    });
    expect(evBet.channelSelectionId).not.toBeNull();
    expect(safeBet.channelSelectionId).not.toBeNull();
    expect(userBet.channelSelectionId).toBeNull();
  });

  it('emits EV REJECTED(BACKFILL) for a NO_BET run without any materialised bet', async () => {
    const runId = await seedNoBetRun();

    const stats = await runBackfill({ db: prisma, args: FULL_RUN });
    expect(stats.evRejected).toBe(1);
    expect(stats.evSelected).toBe(0);

    const decision = await prisma.channelDecision.findFirstOrThrow({
      where: { modelRunId: runId, channel: StrategyChannel.EV },
      include: { selections: true },
    });
    expect(decision.status).toBe(ChannelDecisionStatus.REJECTED);
    expect(decision.reasonCode).toBe('BACKFILL');
    expect(decision.selections).toHaveLength(0);
  });

  it('is idempotent: a second run writes nothing and counts are stable', async () => {
    await seedSelectedRun();
    await seedNoBetRun();

    await runBackfill({ db: prisma, args: FULL_RUN });
    const decisionsAfter1 = await prisma.channelDecision.count();
    const selectionsAfter1 = await prisma.channelSelection.count();

    const stats2 = await runBackfill({ db: prisma, args: FULL_RUN });
    expect(stats2.runsProcessed).toBe(0);
    expect(stats2.runsSkippedFully).toBe(2);
    expect(await prisma.channelDecision.count()).toBe(decisionsAfter1);
    expect(await prisma.channelSelection.count()).toBe(selectionsAfter1);
  });

  it('reconciles: SELECTED selections == MODEL bets + predictions migrated', async () => {
    await seedSelectedRun();
    await seedNoBetRun();
    await runBackfill({ db: prisma, args: FULL_RUN });

    const selectionCount = await prisma.channelSelection.count();
    const modelBetCount = await prisma.bet.count({
      where: { source: BetSource.MODEL },
    });
    const predictionCount = await prisma.prediction.count();
    expect(selectionCount).toBe(modelBetCount + predictionCount);
  });

  async function seedSelectedRun(): Promise<{
    runId: string;
    evBetId: string;
    safeBetId: string;
    userBetId: string;
  }> {
    const fixture = await createFixture(FixtureStatus.FINISHED, 2, 1);
    const runId = await createModelRun(fixture.id, Decision.BET);

    const evBet = await prisma.bet.create({
      data: {
        modelRunId: runId,
        fixtureId: fixture.id,
        market: Market.ONE_X_TWO,
        pick: 'HOME',
        pickKey: pickKey(Market.ONE_X_TWO, 'HOME'),
        probEstimated: 0.62,
        oddsSnapshot: 2.1,
        ev: 0.302,
        qualityScore: 0.18,
        stakePct: 0.01,
        status: BetStatus.WON,
        source: BetSource.MODEL,
        isSafeValue: false,
      },
      select: { id: true },
    });

    const safeBet = await prisma.bet.create({
      data: {
        modelRunId: runId,
        fixtureId: fixture.id,
        market: Market.OVER_UNDER,
        pick: 'UNDER_4_5',
        pickKey: pickKey(Market.OVER_UNDER, 'UNDER_4_5'),
        probEstimated: 0.84,
        oddsSnapshot: 1.27,
        ev: 0.067,
        qualityScore: 0.05,
        stakePct: 0.01,
        status: BetStatus.PENDING,
        source: BetSource.MODEL,
        isSafeValue: true,
      },
      select: { id: true },
    });

    // USER bet must be ignored by the backfill.
    const userBet = await prisma.bet.create({
      data: {
        modelRunId: runId,
        fixtureId: fixture.id,
        market: Market.ONE_X_TWO,
        pick: 'AWAY',
        pickKey: `user:${pickKey(Market.ONE_X_TWO, 'AWAY')}`,
        probEstimated: 0.2,
        oddsSnapshot: 4.5,
        ev: -0.1,
        stakePct: 0.01,
        status: BetStatus.PENDING,
        source: BetSource.USER,
        isSafeValue: false,
      },
      select: { id: true },
    });

    await prisma.prediction.createMany({
      data: [
        {
          fixtureId: fixture.id,
          modelRunId: runId,
          competition: 'EPL',
          channel: PredictionChannel.CONF,
          market: Market.ONE_X_TWO,
          pick: 'HOME',
          probability: 0.67,
          correct: true,
        },
        {
          fixtureId: fixture.id,
          modelRunId: runId,
          competition: 'EPL',
          channel: PredictionChannel.DRAW,
          market: Market.ONE_X_TWO,
          pick: 'DRAW',
          probability: 0.31,
          correct: false,
        },
        {
          fixtureId: fixture.id,
          modelRunId: runId,
          competition: 'EPL',
          channel: PredictionChannel.BTTS,
          market: Market.BTTS,
          pick: 'YES',
          probability: 0.64,
          correct: null,
        },
      ],
    });

    return {
      runId,
      evBetId: evBet.id,
      safeBetId: safeBet.id,
      userBetId: userBet.id,
    };
  }

  async function seedNoBetRun(): Promise<string> {
    const fixture = await createFixture(FixtureStatus.FINISHED, 0, 0);
    return createModelRun(fixture.id, Decision.NO_BET);
  }

  async function createFixture(
    status: FixtureStatus,
    homeScore: number | null,
    awayScore: number | null,
  ): Promise<{ id: string }> {
    const n = counter++;
    const competition = await prisma.competition.create({
      data: {
        leagueId: 20_000 + n,
        name: `League ${n}`,
        code: `BFL-${n}`,
        country: 'EN',
        isActive: true,
      },
      select: { id: true },
    });
    const season = await prisma.season.create({
      data: {
        competitionId: competition.id,
        name: `2025-${n}`,
        startDate: new Date('2025-08-01T00:00:00.000Z'),
        endDate: new Date('2026-05-31T00:00:00.000Z'),
      },
      select: { id: true },
    });
    const home = await prisma.team.create({
      data: {
        externalId: 2000 + n * 2,
        name: `Home ${n}`,
        shortName: `H${n}`,
        competitionId: competition.id,
      },
      select: { id: true },
    });
    const away = await prisma.team.create({
      data: {
        externalId: 2000 + n * 2 + 1,
        name: `Away ${n}`,
        shortName: `A${n}`,
        competitionId: competition.id,
      },
      select: { id: true },
    });
    return prisma.fixture.create({
      data: {
        externalId: 6000 + n,
        seasonId: season.id,
        homeTeamId: home.id,
        awayTeamId: away.id,
        matchday: 1,
        scheduledAt: new Date('2026-01-18T14:00:00.000Z'),
        status,
        homeScore,
        awayScore,
      },
      select: { id: true },
    });
  }

  async function createModelRun(
    fixtureId: string,
    decision: Decision,
  ): Promise<string> {
    const row = await prisma.modelRun.create({
      data: {
        fixtureId,
        decision,
        deterministicScore: 0.75,
        finalScore: 0.75,
        features: {},
        validatedByBackend: true,
      },
      select: { id: true },
    });
    return row.id;
  }

  function pickKey(market: Market, pick: string): string {
    return [market, pick, '-', '-'].join('|');
  }
});
