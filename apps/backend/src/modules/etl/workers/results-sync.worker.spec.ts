import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { ConfigService } from '@nestjs/config';
import type { NotificationService } from '../../notification/notification.service';
import type { FixtureService } from '../../fixture/fixture.service';
import { ResultsSyncWorker } from './results-sync.worker';

function buildResultsResponse(leagueId: number, season: number) {
  return {
    get: 'fixtures',
    parameters: { league: String(leagueId), season: String(season) },
    errors: [],
    results: 2,
    paging: { current: 1, total: 1 },
    response: [
      {
        fixture: {
          id: 1001,
          referee: 'Ref A',
          timezone: 'UTC',
          date: '2024-08-10T19:00:00+00:00',
          timestamp: 1723316400,
          periods: { first: 1723316400, second: 1723320000 },
          venue: { id: 1, name: 'A', city: 'A' },
          status: {
            long: 'Match Finished',
            short: 'FT',
            elapsed: 90,
            extra: null,
          },
        },
        league: {
          id: leagueId,
          name: 'La Liga',
          country: 'Spain',
          logo: 'https://media.api-sports.io/football/leagues/140.png',
          flag: 'https://media.api-sports.io/flags/es.svg',
          season,
          round: 'Regular Season - 1',
          standings: true,
        },
        teams: {
          home: { id: 541, name: 'Real Madrid', logo: 'x', winner: true },
          away: { id: 530, name: 'Atletico Madrid', logo: 'x', winner: false },
        },
        goals: { home: 2, away: 1 },
        score: {
          halftime: { home: 1, away: 1 },
          fulltime: { home: 2, away: 1 },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null },
        },
      },
      {
        fixture: {
          id: 1002,
          referee: null,
          timezone: 'UTC',
          date: '2024-08-11T19:00:00+00:00',
          timestamp: 1723402800,
          periods: { first: null, second: null },
          venue: { id: 2, name: 'B', city: 'B' },
          status: {
            long: 'Not Started',
            short: 'NS',
            elapsed: null,
            extra: null,
          },
        },
        league: {
          id: leagueId,
          name: 'La Liga',
          country: 'Spain',
          logo: 'https://media.api-sports.io/football/leagues/140.png',
          flag: 'https://media.api-sports.io/flags/es.svg',
          season,
          round: 'Regular Season - 1',
          standings: true,
        },
        teams: {
          home: { id: 536, name: 'Sevilla', logo: 'x', winner: null },
          away: { id: 548, name: 'Getafe', logo: 'x', winner: null },
        },
        goals: { home: null, away: null },
        score: {
          halftime: { home: null, away: null },
          fulltime: { home: null, away: null },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null },
        },
      },
    ],
  };
}

describe('ResultsSyncWorker', () => {
  const fixtureService = {
    updateScores: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<FixtureService>;

  const config = {
    getOrThrow: vi.fn().mockReturnValue('test-api-key'),
  } satisfies Partial<ConfigService>;

  const notification = {
    sendEtlFailureAlert: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<NotificationService>;

  const worker = new ResultsSyncWorker(
    fixtureService as unknown as FixtureService,
    config as unknown as ConfigService,
    notification as unknown as NotificationService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    config.getOrThrow.mockReturnValue('test-api-key');
    fixtureService.updateScores.mockResolvedValue(undefined);
  });

  it('uses competitionCode to resolve league and updates only finished fixtures', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(buildResultsResponse(140, 2024)),
    });

    await worker.process({
      data: { competitionCode: 'LL', season: 2024 },
    } as Job<{ competitionCode: string; season: number }>);

    expect(fetch).toHaveBeenCalledWith(
      'https://v3.football.api-sports.io/fixtures?league=140&season=2024&status=FT-AET-PEN',
      { headers: { 'x-apisports-key': 'test-api-key' } },
    );
    expect(fixtureService.updateScores).toHaveBeenCalledTimes(1);
    expect(fixtureService.updateScores).toHaveBeenCalledWith(1001, 2, 1, 1, 1);
  });

  it('throws on non-ok API response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    await expect(
      worker.process({
        data: { competitionCode: 'LL', season: 2024 },
      } as Job<{ competitionCode: string; season: number }>),
    ).rejects.toThrow('API-FOOTBALL responded 500 for season 2024');
  });
});
