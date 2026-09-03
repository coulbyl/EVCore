import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { PersonalizationService } from './personalization.service';
import type { PersonalizationRepository } from './personalization.repository';
import type { DashboardService } from '@modules/dashboard/dashboard.service';
import type { ChannelHealthItem } from '@modules/dashboard/dashboard.types';

function makeRepo(): PersonalizationRepository {
  return {
    listFollowedChannels: vi.fn().mockResolvedValue([]),
    listFollowedLeagues: vi.fn().mockResolvedValue([]),
    findActiveCompetitions: vi.fn().mockResolvedValue([]),
    competitionExists: vi.fn().mockResolvedValue(true),
    followChannel: vi.fn().mockResolvedValue(undefined),
    unfollowChannel: vi.fn().mockResolvedValue(undefined),
    followLeague: vi.fn().mockResolvedValue(undefined),
    unfollowLeague: vi.fn().mockResolvedValue(undefined),
  } as unknown as PersonalizationRepository;
}

function makeDashboard(health: ChannelHealthItem[] = []): DashboardService {
  return {
    getChannelHealth: vi.fn().mockResolvedValue(health),
  } as unknown as DashboardService;
}

describe('PersonalizationService', () => {
  it('lists followed channels and leagues with an ISO "since" timestamp', async () => {
    const repo = makeRepo();
    vi.mocked(repo.listFollowedChannels).mockResolvedValue([
      { channel: 'DRAW', createdAt: new Date('2026-08-12T00:00:00Z') },
    ]);
    vi.mocked(repo.listFollowedLeagues).mockResolvedValue([
      {
        competitionCode: 'PL',
        createdAt: new Date('2026-08-03T00:00:00Z'),
        name: 'Premier League',
        country: 'England',
      },
    ]);
    const service = new PersonalizationService(repo, makeDashboard());

    const result = await service.getPersonalization('user-1');

    expect(result.followedChannels).toEqual([
      { channel: 'DRAW', since: '2026-08-12T00:00:00.000Z' },
    ]);
    expect(result.followedLeagues).toEqual([
      {
        code: 'PL',
        name: 'Premier League',
        country: 'England',
        since: '2026-08-03T00:00:00.000Z',
      },
    ]);
  });

  it('follows a channel that is eligible', async () => {
    const repo = makeRepo();
    const service = new PersonalizationService(repo, makeDashboard());

    await service.followChannel('user-1', 'DRAW');

    expect(repo.followChannel).toHaveBeenCalledWith('user-1', 'DRAW');
  });

  it('rejects following a channel outside the eligible pool (VALUE — Phase-2 filter)', async () => {
    const repo = makeRepo();
    const service = new PersonalizationService(repo, makeDashboard());

    await expect(service.followChannel('user-1', 'VALUE')).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.followChannel).not.toHaveBeenCalled();
  });

  it('rejects an unknown channel string', async () => {
    const repo = makeRepo();
    const service = new PersonalizationService(repo, makeDashboard());

    await expect(
      service.followChannel('user-1', 'NOT_A_CHANNEL'),
    ).rejects.toThrow(BadRequestException);
  });

  it('follows a league that is active', async () => {
    const repo = makeRepo();
    const service = new PersonalizationService(repo, makeDashboard());

    await service.followLeague('user-1', 'PL');

    expect(repo.followLeague).toHaveBeenCalledWith('user-1', 'PL');
  });

  it('rejects following an inactive or unknown league code', async () => {
    const repo = makeRepo();
    vi.mocked(repo.competitionExists).mockResolvedValue(false);
    const service = new PersonalizationService(repo, makeDashboard());

    await expect(service.followLeague('user-1', 'XX')).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.followLeague).not.toHaveBeenCalled();
  });

  it('unfollows without validating the league still exists', async () => {
    const repo = makeRepo();
    const service = new PersonalizationService(repo, makeDashboard());

    await service.unfollowLeague('user-1', 'PL');

    expect(repo.competitionExists).not.toHaveBeenCalled();
    expect(repo.unfollowLeague).toHaveBeenCalledWith('user-1', 'PL');
  });

  it('marks a channel as proven only when measured GREEN, and flags already-followed channels', async () => {
    const repo = makeRepo();
    vi.mocked(repo.listFollowedChannels).mockResolvedValue([
      { channel: 'DRAW', createdAt: new Date() },
    ]);
    const health: ChannelHealthItem[] = [
      {
        channel: 'DRAW',
        status: 'GREEN',
        primaryMetric: 0.98,
        primaryMetricType: 'HIT_RATE',
        roi: null,
        hitRate: 0.98,
        calibrationRatio: 0.98,
        vsThreshold: null,
        sampleSize: 2400,
      },
      {
        channel: 'BTTS',
        status: 'ORANGE',
        primaryMetric: 0.84,
        primaryMetricType: 'HIT_RATE',
        roi: null,
        hitRate: 0.84,
        calibrationRatio: 0.84,
        vsThreshold: null,
        sampleSize: 1119,
      },
    ];
    const service = new PersonalizationService(repo, makeDashboard(health));

    const result = await service.discoverChannels('user-1');

    const draw = result.find((r) => r.channel === 'DRAW');
    const btts = result.find((r) => r.channel === 'BTTS');
    expect(draw).toMatchObject({
      proven: true,
      followed: true,
      sampleSize: 2400,
    });
    expect(btts).toMatchObject({
      proven: false,
      followed: false,
      sampleSize: 1119,
    });
    // VALUE/SAFE (Phase-2 filters) and CONSENSUS/CONTRARIAN/AVOID/VANTAGE
    // (Phase-3 meta) are never eligible to follow — §2quater.
    expect(result.some((r) => r.channel === 'VALUE')).toBe(false);
    expect(result.some((r) => r.channel === 'CONSENSUS')).toBe(false);
  });

  it('defaults sampleSize to 0 and proven to false for a channel with no settled history', async () => {
    const repo = makeRepo();
    const service = new PersonalizationService(repo, makeDashboard([]));

    const result = await service.discoverChannels('user-1');

    const anyChannel = result[0];
    expect(anyChannel).toMatchObject({
      calibrationRatio: null,
      sampleSize: 0,
      proven: false,
      followed: false,
    });
  });
});
