import { describe, expect, it, vi } from 'vitest';
import {
  BetStatus,
  FixtureStatus,
  ModelRunPhase,
  StrategyChannel,
} from '@evcore/db';
import type { PrismaService } from '@/prisma.service';
import {
  ChannelDecisionRepository,
  latestPerFixtureChannel,
  type ChannelDecisionReadRow,
} from './channel-decision.repository';
import { CHANNEL_DECISION_STATUS } from './channel-strategy.types';

function row(
  overrides: Partial<ChannelDecisionReadRow>,
): ChannelDecisionReadRow {
  return {
    id: 'cd-1',
    modelRunId: 'mr-1',
    phase: ModelRunPhase.ADVANCE,
    analyzedAt: new Date('2026-06-30T14:00:00Z'),
    channel: StrategyChannel.VALUE,
    status: CHANNEL_DECISION_STATUS.SELECTED,
    reasonCode: null,
    reasonDetails: null,
    fixtureId: 'fx-1',
    fixtureStatus: FixtureStatus.SCHEDULED,
    scheduledAt: new Date('2026-07-02T23:00:00Z'),
    homeTeamId: 'team-portugal',
    awayTeamId: 'team-croatia',
    homeTeam: 'Portugal',
    awayTeam: 'Croatia',
    homeLogo: null,
    awayLogo: null,
    competitionCode: 'WC',
    country: null,
    homeScore: null,
    awayScore: null,
    homeHtScore: null,
    awayHtScore: null,
    selections: [],
    result: null as unknown as BetStatus,
    ...overrides,
  } as ChannelDecisionReadRow;
}

describe('latestPerFixtureChannel', () => {
  it('keeps only the most recently analyzed decision per (fixture, channel)', () => {
    const rows = [
      row({
        id: 'cd-advance',
        modelRunId: 'mr-advance',
        analyzedAt: new Date('2026-06-30T14:00:00Z'),
      }),
      row({
        id: 'cd-pre-kickoff',
        modelRunId: 'mr-pre-kickoff',
        analyzedAt: new Date('2026-07-01T01:00:00Z'),
      }),
      row({
        id: 'cd-live',
        modelRunId: 'mr-live',
        analyzedAt: new Date('2026-07-02T22:55:00Z'),
      }),
    ];

    const result = latestPerFixtureChannel(rows);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cd-live');
  });

  it('does not merge across different channels or different fixtures', () => {
    const rows = [
      row({
        id: 'value-fx1',
        fixtureId: 'fx-1',
        channel: StrategyChannel.VALUE,
      }),
      row({ id: 'safe-fx1', fixtureId: 'fx-1', channel: StrategyChannel.SAFE }),
      row({
        id: 'value-fx2',
        fixtureId: 'fx-2',
        channel: StrategyChannel.VALUE,
      }),
    ];

    const result = latestPerFixtureChannel(rows);

    expect(result.map((r) => r.id).sort()).toEqual(
      ['safe-fx1', 'value-fx1', 'value-fx2'].sort(),
    );
  });

  it('is a no-op when there is only one analysis pass per fixture', () => {
    const rows = [row({ id: 'only-one' })];
    expect(latestPerFixtureChannel(rows)).toEqual(rows);
  });
});

describe('ChannelDecisionRepository.findNewCoachTeams', () => {
  function makeRepo(coachTenureRows: unknown[], gamesPlayed: number) {
    const coachTenureFindMany = vi.fn().mockResolvedValue(coachTenureRows);
    const fixtureCount = vi.fn().mockResolvedValue(gamesPlayed);
    const prisma = {
      client: {
        coachTenure: { findMany: coachTenureFindMany },
        fixture: { count: fixtureCount },
      },
    } as unknown as PrismaService;

    return { repo: new ChannelDecisionRepository(prisma), fixtureCount };
  }

  it('flags a team under NEW_COACH_WINDOW_MATCHES finished matches since their current coach started', async () => {
    const { repo, fixtureCount } = makeRepo(
      [{ teamId: 'team-a', startDate: new Date('2026-06-01T00:00:00Z') }],
      3,
    );

    const result = await repo.findNewCoachTeams(
      new Map([['team-a', new Date('2026-07-01T00:00:00Z')]]),
    );

    expect(result).toEqual(new Set(['team-a']));
    expect(fixtureCount).toHaveBeenCalledWith({
      where: {
        OR: [{ homeTeamId: 'team-a' }, { awayTeamId: 'team-a' }],
        status: 'FINISHED',
        scheduledAt: {
          gte: new Date('2026-06-01T00:00:00Z'),
          lt: new Date('2026-07-01T00:00:00Z'),
        },
      },
    });
  });

  it('does not flag a team that has played 5+ matches under their current coach', async () => {
    const { repo } = makeRepo(
      [{ teamId: 'team-a', startDate: new Date('2026-01-01T00:00:00Z') }],
      5,
    );

    const result = await repo.findNewCoachTeams(
      new Map([['team-a', new Date('2026-07-01T00:00:00Z')]]),
    );

    expect(result).toEqual(new Set());
  });

  it('skips a team with no coach_tenure row on or before its match date', async () => {
    const { repo } = makeRepo(
      // Only a future tenure — not yet in charge as of the match date.
      [{ teamId: 'team-a', startDate: new Date('2026-08-01T00:00:00Z') }],
      0,
    );

    const result = await repo.findNewCoachTeams(
      new Map([['team-a', new Date('2026-07-01T00:00:00Z')]]),
    );

    expect(result).toEqual(new Set());
  });

  it('returns an empty set without querying when given no teams', async () => {
    const { repo, fixtureCount } = makeRepo([], 0);

    const result = await repo.findNewCoachTeams(new Map());

    expect(result).toEqual(new Set());
    expect(fixtureCount).not.toHaveBeenCalled();
  });
});
