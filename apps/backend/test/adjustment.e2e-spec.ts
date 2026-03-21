import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import {
  BetStatus,
  Decision,
  FixtureStatus,
  Market,
  AdjustmentStatus,
  prisma,
} from '@evcore/db';
import { PrismaModule } from '@/prisma.module';
import { BettingEngineService } from '@modules/betting-engine/betting-engine.service';
import { AdjustmentService } from '@modules/adjustment/adjustment.service';
import { CalibrationService } from '@modules/adjustment/calibration.service';
import { NotificationService } from '@modules/notification/notification.service';
import { FEATURE_WEIGHTS } from '@modules/betting-engine/ev.constants';
import { truncateAllTables } from './setup/prisma-test';

describe('Adjustment flow (e2e)', () => {
  let moduleRef: TestingModule;
  let bettingEngine: BettingEngineService;
  let adjustment: AdjustmentService;
  let counter = 1;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
      providers: [
        BettingEngineService,
        CalibrationService,
        NotificationService,
        AdjustmentService,
      ],
    }).compile();

    bettingEngine = moduleRef.get(BettingEngineService);
    adjustment = moduleRef.get(AdjustmentService);
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await moduleRef.close();
    await prisma.$disconnect();
  });

  it('settles pending bets for a finished fixture', async () => {
    const fixture = await createFixture({
      status: FixtureStatus.FINISHED,
      homeScore: 2,
      awayScore: 1,
    });
    const modelRunId = await createModelRun(fixture.id);

    await prisma.bet.createMany({
      data: [
        {
          modelRunId,
          fixtureId: fixture.id,
          market: Market.ONE_X_TWO,
          pick: 'HOME',
          pickKey: createPickKey(Market.ONE_X_TWO, 'HOME'),
          probEstimated: 0.62,
          oddsSnapshot: 2.1,
          ev: 0.302,
          stakePct: 0.01,
          status: BetStatus.PENDING,
        },
        {
          modelRunId,
          fixtureId: fixture.id,
          market: Market.ONE_X_TWO,
          pick: 'DRAW',
          pickKey: createPickKey(Market.ONE_X_TWO, 'DRAW'),
          probEstimated: 0.21,
          oddsSnapshot: 3.3,
          ev: -0.307,
          stakePct: 0.01,
          status: BetStatus.PENDING,
        },
        {
          modelRunId,
          fixtureId: fixture.id,
          market: Market.ONE_X_TWO,
          pick: 'UNKNOWN',
          pickKey: createPickKey(Market.ONE_X_TWO, 'UNKNOWN'),
          probEstimated: 0.17,
          oddsSnapshot: 6.2,
          ev: 0.054,
          stakePct: 0.01,
          status: BetStatus.PENDING,
        },
      ],
    });

    const result = await bettingEngine.settleOpenBets(fixture.id);
    expect(result).toEqual({ settled: 3 });

    const statuses = await prisma.bet.findMany({
      select: { pick: true, status: true },
      orderBy: { pick: 'asc' },
    });
    expect(statuses).toEqual([
      { pick: 'DRAW', status: BetStatus.LOST },
      { pick: 'HOME', status: BetStatus.WON },
      { pick: 'UNKNOWN', status: BetStatus.VOID },
    ]);
  });

  it('reads applied weights when an adjustment proposal exists', async () => {
    const defaults = await bettingEngine.getEffectiveWeights();
    expect(defaults.recentForm.toString()).toBe(
      FEATURE_WEIGHTS.recentForm.toString(),
    );

    await prisma.adjustmentProposal.create({
      data: {
        triggerBetCount: 99,
        currentWeights: {
          recentForm: '0.300000',
          xg: '0.300000',
          domExtPerf: '0.200000',
          leagueVolat: '0.200000',
        },
        proposedWeights: {
          recentForm: '0.260000',
          xg: '0.350000',
          domExtPerf: '0.210000',
          leagueVolat: '0.180000',
        },
        calibrationError: 0.31,
        status: AdjustmentStatus.APPLIED,
        appliedAt: new Date(),
      },
    });

    const adjusted = await bettingEngine.getEffectiveWeights();
    expect(adjusted.recentForm.toString()).toBe('0.26');
    expect(adjusted.xg.toString()).toBe('0.35');
    expect(adjusted.domExtPerf.toString()).toBe('0.21');
    expect(adjusted.leagueVolat.toString()).toBe('0.18');
  });

  it('auto-applies a proposal when calibration threshold is exceeded', async () => {
    const fixture = await createFixture({
      status: FixtureStatus.FINISHED,
      homeScore: 1,
      awayScore: 0,
    });
    const modelRunId = await createModelRun(fixture.id);

    await prisma.bet.create({
      data: {
        modelRunId,
        fixtureId: fixture.id,
        market: Market.ONE_X_TWO,
        pick: 'HOME',
        pickKey: createPickKey(Market.ONE_X_TWO, 'HOME'),
        probEstimated: 0.65,
        oddsSnapshot: 1.8,
        ev: 0.17,
        stakePct: 0.01,
        status: BetStatus.PENDING,
      },
    });

    const degradedModelRunId = await createModelRun(fixture.id);
    await prisma.bet.createMany({
      data: Array.from({ length: 50 }, () => ({
        modelRunId: degradedModelRunId,
        fixtureId: fixture.id,
        market: Market.ONE_X_TWO,
        pick: 'DRAW',
        pickKey: createPickKey(Market.ONE_X_TWO, 'DRAW'),
        probEstimated: 0.9,
        oddsSnapshot: 3.2,
        ev: 1.88,
        stakePct: 0.01,
        status: BetStatus.LOST,
      })),
    });

    const result = await adjustment.settleAndCheck(fixture.id);

    expect(result.settled).toBe(1);
    expect(result.calibration).not.toBeNull();
    expect(result.proposalId).not.toBeNull();

    const proposals = await prisma.adjustmentProposal.findMany({
      where: { status: AdjustmentStatus.APPLIED },
    });
    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.triggerBetCount).toBeGreaterThanOrEqual(50);
  });

  async function createFixture(params: {
    status: FixtureStatus;
    homeScore: number | null;
    awayScore: number | null;
  }): Promise<{ id: string }> {
    const n = counter++;

    const competition = await prisma.competition.create({
      data: {
        leagueId: 10_000 + n,
        name: `Premier League ${n}`,
        code: `EPL-${n}`,
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
        externalId: 1000 + n * 2,
        name: `Home ${n}`,
        shortName: `H${n}`,
        competitionId: competition.id,
      },
      select: { id: true },
    });

    const away = await prisma.team.create({
      data: {
        externalId: 1000 + n * 2 + 1,
        name: `Away ${n}`,
        shortName: `A${n}`,
        competitionId: competition.id,
      },
      select: { id: true },
    });

    return prisma.fixture.create({
      data: {
        externalId: 5000 + n,
        seasonId: season.id,
        homeTeamId: home.id,
        awayTeamId: away.id,
        matchday: 1,
        scheduledAt: new Date('2026-01-18T14:00:00.000Z'),
        status: params.status,
        homeScore: params.homeScore,
        awayScore: params.awayScore,
      },
      select: { id: true },
    });
  }

  async function createModelRun(fixtureId: string): Promise<string> {
    const row = await prisma.modelRun.create({
      data: {
        fixtureId,
        decision: Decision.BET,
        deterministicScore: 0.75,
        llmDelta: null,
        finalScore: 0.75,
        features: {
          recentForm: 0.5,
          xg: 0.5,
          performanceDomExt: 0.5,
          volatiliteLigue: 0.5,
          lambdaHome: 1.2,
          lambdaAway: 0.8,
          probabilities: {
            home: 0.5,
            draw: 0.25,
            away: 0.25,
          },
        },
        validatedByBackend: true,
      },
      select: { id: true },
    });

    return row.id;
  }

  function createPickKey(market: Market, pick: string): string {
    return [market, pick, '-', '-'].join('|');
  }
});
