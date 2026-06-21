import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import Decimal from 'decimal.js';
import {
  BetStatus,
  ChannelDecisionStatus,
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
    const persisted = await repo.saveRunDecisions(runId, sampleDecisions());

    // The returned selection ids must match the rows actually written.
    const evPersisted = persisted.find(
      (d) => d.channel === StrategyChannel.VALUE,
    );
    const evSelectionId = evPersisted?.selections[0]?.id;
    expect(evSelectionId).toBeDefined();
    const evSelectionRow = await prisma.channelSelection.findUnique({
      where: { id: evSelectionId },
    });
    expect(evSelectionRow?.pick).toBe('HOME');
    // A rejected channel carries no selection ids.
    expect(
      persisted.find((d) => d.channel === StrategyChannel.SAFE)?.selections,
    ).toHaveLength(0);

    const decisions = await prisma.channelDecision.findMany({
      where: { modelRunId: runId },
      include: { selections: true },
      orderBy: { channel: 'asc' },
    });
    expect(decisions).toHaveLength(3);

    const ev = decisions.find((d) => d.channel === StrategyChannel.VALUE);
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

  it('finds a fixture selections and applies analytical results', async () => {
    const runId = await createModelRun();
    await repo.saveRunDecisions(runId, sampleDecisions());
    const run = await prisma.modelRun.findUnique({
      where: { id: runId },
      select: { fixtureId: true },
    });
    const fixtureId = run!.fixtureId;

    // Only the two SELECTED channels (EV, DRAW) carry selections.
    const unsettled = await repo.findSelectionsForFixture(fixtureId, {
      onlyUnsettled: true,
    });
    expect(unsettled).toHaveLength(2);

    const ev = unsettled.find((s) => s.pick === 'HOME');
    await repo.applySelectionResults([{ id: ev!.id, result: BetStatus.WON }]);

    const settledRow = await prisma.channelSelection.findUnique({
      where: { id: ev!.id },
    });
    expect(settledRow?.result).toBe(BetStatus.WON);
    expect(settledRow?.settledAt).not.toBeNull();

    // The settled row is excluded from the next onlyUnsettled pass.
    const stillUnsettled = await repo.findSelectionsForFixture(fixtureId, {
      onlyUnsettled: true,
    });
    expect(stillUnsettled).toHaveLength(1);
  });

  it('lists decisions by date with channel and market filters', async () => {
    const runId = await createModelRun();
    await repo.saveRunDecisions(runId, sampleDecisions());
    // Fixtures created by the helper are scheduled on 2026-01-18.
    const range = {
      gte: new Date('2026-01-18T00:00:00.000Z'),
      lte: new Date('2026-01-18T23:59:59.999Z'),
    };

    const all = await repo.findByDate({ range });
    expect(all.length).toBeGreaterThanOrEqual(3);
    const ev = all.find((d) => d.channel === StrategyChannel.VALUE);
    expect(ev?.fixtureId).toBeDefined();
    expect(ev?.homeTeam).toContain('Home');
    expect(ev?.selections[0]?.pick).toBe('HOME');

    // Channel filter narrows to a single decision.
    const onlyEv = await repo.findByDate({
      range,
      channel: StrategyChannel.VALUE,
    });
    expect(onlyEv.every((d) => d.channel === StrategyChannel.VALUE)).toBe(true);

    // Market filter keeps only decisions that selected on that market.
    const onlyBtts = await repo.findByDate({ range, market: Market.BTTS });
    expect(onlyBtts).toHaveLength(0);

    // A date outside the range returns nothing.
    const empty = await repo.findByDate({
      range: {
        gte: new Date('2026-02-01T00:00:00.000Z'),
        lte: new Date('2026-02-01T23:59:59.999Z'),
      },
    });
    expect(empty).toHaveLength(0);
  });

  function sampleDecisions(): StrategyDecision[] {
    return [
      {
        channel: StrategyChannel.VALUE,
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
