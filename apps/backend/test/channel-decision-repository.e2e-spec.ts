import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import Decimal from 'decimal.js';
import {
  ChannelDecisionStatus,
  Decision,
  FixtureStatus,
  Market,
  StrategyChannel,
  prisma,
} from '@evcore/db';
import { PrismaModule } from '@/prisma.module';
import { ChannelDecisionRepository } from '@modules/betting-engine/channel-decision.repository';
import type { StrategyDecision } from '@modules/betting-engine/channel-strategy.types';
import { truncateAllTables } from './setup/prisma-test';

describe('ChannelDecisionRepository (e2e)', () => {
  let moduleRef: TestingModule;
  let repo: ChannelDecisionRepository;
  let counter = 1;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
      providers: [ChannelDecisionRepository],
    }).compile();
    repo = moduleRef.get(ChannelDecisionRepository);
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await moduleRef.close();
    await prisma.$disconnect();
  });

  it('persists decisions and selections for a run', async () => {
    const runId = await createModelRun();
    await repo.saveRunDecisions(runId, sampleDecisions());

    const decisions = await prisma.channelDecision.findMany({
      where: { modelRunId: runId },
      include: { selections: true },
      orderBy: { channel: 'asc' },
    });
    expect(decisions).toHaveLength(3);

    const ev = decisions.find((d) => d.channel === StrategyChannel.EV);
    expect(ev?.status).toBe(ChannelDecisionStatus.SELECTED);
    expect(ev?.selections).toHaveLength(1);
    expect(ev?.selections[0]?.pick).toBe('HOME');
    expect(ev?.selections[0]?.odds?.toString()).toBe('1.9');

    const draw = decisions.find((d) => d.channel === StrategyChannel.DRAW);
    expect(draw?.selections[0]?.impliedProbability?.toString()).toBe('0.303');

    const safe = decisions.find((d) => d.channel === StrategyChannel.SAFE);
    expect(safe?.status).toBe(ChannelDecisionStatus.REJECTED);
    expect(safe?.reasonCode).toBe('no_safe_candidate');
    expect(safe?.selections).toHaveLength(0);
  });

  it('rejects a double-write for the same (run, channel)', async () => {
    const runId = await createModelRun();
    await repo.saveRunDecisions(runId, sampleDecisions());
    await expect(
      repo.saveRunDecisions(runId, sampleDecisions()),
    ).rejects.toThrow();
  });

  it('is a no-op for an empty decision list', async () => {
    const runId = await createModelRun();
    await repo.saveRunDecisions(runId, []);
    expect(
      await prisma.channelDecision.count({ where: { modelRunId: runId } }),
    ).toBe(0);
  });

  function sampleDecisions(): StrategyDecision[] {
    return [
      {
        channel: StrategyChannel.EV,
        status: ChannelDecisionStatus.SELECTED,
        selections: [
          {
            market: Market.ONE_X_TWO,
            pick: 'HOME',
            probability: new Decimal('0.6'),
            odds: new Decimal('1.9'),
            ev: new Decimal('0.14'),
            qualityScore: new Decimal('0.2'),
            rank: 1,
          },
        ],
      },
      {
        channel: StrategyChannel.DRAW,
        status: ChannelDecisionStatus.SELECTED,
        selections: [
          {
            market: Market.ONE_X_TWO,
            pick: 'DRAW',
            probability: new Decimal('0.303'),
            impliedProbability: new Decimal('0.303'),
            rank: 1,
          },
        ],
      },
      {
        channel: StrategyChannel.SAFE,
        status: ChannelDecisionStatus.REJECTED,
        reasonCode: 'no_safe_candidate',
        reasonDetails: { candidates: 0 },
        selections: [],
      },
    ];
  }

  async function createModelRun(): Promise<string> {
    const n = counter++;
    const competition = await prisma.competition.create({
      data: {
        leagueId: 40_000 + n,
        name: `League ${n}`,
        code: `CDR-${n}`,
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
        externalId: 4000 + n * 2,
        name: `Home ${n}`,
        shortName: `H${n}`,
        competitionId: competition.id,
      },
      select: { id: true },
    });
    const away = await prisma.team.create({
      data: {
        externalId: 4000 + n * 2 + 1,
        name: `Away ${n}`,
        shortName: `A${n}`,
        competitionId: competition.id,
      },
      select: { id: true },
    });
    const fixture = await prisma.fixture.create({
      data: {
        externalId: 8000 + n,
        seasonId: season.id,
        homeTeamId: home.id,
        awayTeamId: away.id,
        matchday: 1,
        scheduledAt: new Date('2026-01-18T14:00:00.000Z'),
        status: FixtureStatus.FINISHED,
        homeScore: 1,
        awayScore: 0,
      },
      select: { id: true },
    });
    const run = await prisma.modelRun.create({
      data: {
        fixtureId: fixture.id,
        decision: Decision.BET,
        deterministicScore: 0.75,
        finalScore: 0.75,
        features: {},
        validatedByBackend: true,
      },
      select: { id: true },
    });
    return run.id;
  }
});
