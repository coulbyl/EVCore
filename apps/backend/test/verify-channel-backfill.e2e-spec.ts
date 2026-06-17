import {
  BetSource,
  BetStatus,
  Decision,
  FixtureStatus,
  Market,
  PredictionChannel,
  prisma,
} from '@evcore/db';
import {
  runBackfill,
  type BackfillArgs,
} from '@/scripts/backfill-channel-decisions.lib';
import { verifyBackfill } from '@/scripts/verify-channel-backfill.lib';
import { truncateAllTables } from './setup/prisma-test';

const FULL_RUN: BackfillArgs = {
  from: null,
  to: null,
  limit: null,
  batchSize: 500,
  dryRun: false,
};

function checkOk(
  report: Awaited<ReturnType<typeof verifyBackfill>>,
  name: string,
): boolean {
  return report.checks.find((c) => c.name === name)?.ok ?? false;
}

describe('Verify channel backfill gate (e2e)', () => {
  let counter = 1;

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('reports a GREEN gate after a clean backfill', async () => {
    await seedScenario();
    await runBackfill({ db: prisma, args: FULL_RUN });

    const report = await verifyBackfill(prisma);
    expect(report.ok).toBe(true);
    expect(report.checks.every((c) => c.ok)).toBe(true);
  });

  it('fails count_parity when a selection is missing', async () => {
    await seedScenario();
    await runBackfill({ db: prisma, args: FULL_RUN });

    const victim = await prisma.channelSelection.findFirstOrThrow();
    await prisma.bet.updateMany({
      where: { channelSelectionId: victim.id },
      data: { channelSelectionId: null },
    });
    await prisma.channelSelection.delete({ where: { id: victim.id } });

    const report = await verifyBackfill(prisma);
    expect(report.ok).toBe(false);
    expect(checkOk(report, 'count_parity')).toBe(false);
  });

  it('fails all_model_bets_linked when a MODEL bet is unlinked', async () => {
    await seedScenario();
    await runBackfill({ db: prisma, args: FULL_RUN });

    await prisma.bet.updateMany({
      where: { source: BetSource.MODEL, isSafeValue: false },
      data: { channelSelectionId: null },
    });

    const report = await verifyBackfill(prisma);
    expect(report.ok).toBe(false);
    expect(checkOk(report, 'all_model_bets_linked')).toBe(false);
  });

  it('fails settled_parity when a legacy result diverges from the new one', async () => {
    await seedScenario();
    await runBackfill({ db: prisma, args: FULL_RUN });

    // Flip the EV bet result without touching its ChannelSelection → divergence.
    await prisma.bet.updateMany({
      where: { source: BetSource.MODEL, isSafeValue: false },
      data: { status: BetStatus.LOST },
    });

    const report = await verifyBackfill(prisma);
    expect(report.ok).toBe(false);
    expect(checkOk(report, 'settled_parity_EV')).toBe(false);
  });

  async function seedScenario(): Promise<void> {
    const fixture = await createFixture(FixtureStatus.FINISHED, 2, 1);
    const runId = await createModelRun(fixture.id, Decision.BET);

    await prisma.bet.create({
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
    });
    await prisma.bet.create({
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

    // A NO_BET run → EV REJECTED(BACKFILL), no selection.
    const noBetFixture = await createFixture(FixtureStatus.FINISHED, 0, 0);
    await createModelRun(noBetFixture.id, Decision.NO_BET);
  }

  async function createFixture(
    status: FixtureStatus,
    homeScore: number | null,
    awayScore: number | null,
  ): Promise<{ id: string }> {
    const n = counter++;
    const competition = await prisma.competition.create({
      data: {
        leagueId: 30_000 + n,
        name: `League ${n}`,
        code: `VFL-${n}`,
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
        externalId: 3000 + n * 2,
        name: `Home ${n}`,
        shortName: `H${n}`,
        competitionId: competition.id,
      },
      select: { id: true },
    });
    const away = await prisma.team.create({
      data: {
        externalId: 3000 + n * 2 + 1,
        name: `Away ${n}`,
        shortName: `A${n}`,
        competitionId: competition.id,
      },
      select: { id: true },
    });
    return prisma.fixture.create({
      data: {
        externalId: 7000 + n,
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
