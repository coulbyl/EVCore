import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@/prisma.service';
import { ChannelDecisionRepository } from './channel-decision.repository';

describe('ChannelDecisionRepository.findNewCoachTeams', () => {
  function makeRepo(coachTenureRows: unknown[], fixtureRows: unknown[]) {
    const coachTenureFindMany = vi.fn().mockResolvedValue(coachTenureRows);
    const fixtureFindMany = vi.fn().mockResolvedValue(fixtureRows);
    const prisma = {
      client: {
        coachTenure: { findMany: coachTenureFindMany },
        fixture: { findMany: fixtureFindMany },
      },
    } as unknown as PrismaService;

    return { repo: new ChannelDecisionRepository(prisma), fixtureFindMany };
  }

  it('flags a team under NEW_COACH_WINDOW_MATCHES finished matches since their current coach started', async () => {
    const { repo, fixtureFindMany } = makeRepo(
      [{ teamId: 'team-a', startDate: new Date('2026-06-01T00:00:00Z') }],
      [
        {
          homeTeamId: 'team-a',
          awayTeamId: 'team-x',
          scheduledAt: new Date('2026-06-10T00:00:00Z'),
        },
        {
          homeTeamId: 'team-y',
          awayTeamId: 'team-a',
          scheduledAt: new Date('2026-06-20T00:00:00Z'),
        },
        {
          homeTeamId: 'team-a',
          awayTeamId: 'team-z',
          scheduledAt: new Date('2026-06-25T00:00:00Z'),
        },
      ],
    );

    const result = await repo.findNewCoachTeams(
      new Map([['team-a', new Date('2026-07-01T00:00:00Z')]]),
    );

    expect(result).toEqual(new Set(['team-a']));
    expect(fixtureFindMany).toHaveBeenCalledWith({
      where: {
        OR: [{ homeTeamId: 'team-a' }, { awayTeamId: 'team-a' }],
        status: 'FINISHED',
        scheduledAt: {
          gte: new Date('2026-06-01T00:00:00Z'),
          lt: new Date('2026-07-01T00:00:00Z'),
        },
      },
      select: { homeTeamId: true, awayTeamId: true, scheduledAt: true },
    });
  });

  it('does not flag a team that has played 5+ matches under their current coach', async () => {
    const fixtures = Array.from({ length: 5 }, (_, i) => ({
      homeTeamId: 'team-a',
      awayTeamId: 'team-x',
      scheduledAt: new Date(2026, 0, i + 1),
    }));
    const { repo } = makeRepo(
      [{ teamId: 'team-a', startDate: new Date('2026-01-01T00:00:00Z') }],
      fixtures,
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
      [],
    );

    const result = await repo.findNewCoachTeams(
      new Map([['team-a', new Date('2026-07-01T00:00:00Z')]]),
    );

    expect(result).toEqual(new Set());
  });

  it('returns an empty set without querying when given no teams', async () => {
    const { repo, fixtureFindMany } = makeRepo([], []);

    const result = await repo.findNewCoachTeams(new Map());

    expect(result).toEqual(new Set());
    expect(fixtureFindMany).not.toHaveBeenCalled();
  });
});
