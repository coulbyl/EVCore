import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { ConfigService } from '@nestjs/config';
import type { NotificationService } from '../../notification/notification.service';
import type { FixtureService } from '../../fixture/fixture.service';
import type { PrismaService } from '@/prisma.service';
import type { Queue } from 'bullmq';
import { FixturesSyncWorker } from './fixtures-sync.worker';
import type { InjuriesSyncJobData } from './injuries-sync.worker';

function buildFixturesResponse(leagueId: number, season: number) {
  return {
    get: 'fixtures',
    parameters: { league: String(leagueId), season: String(season) },
    errors: [],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [
      {
        fixture: {
          id: 867946,
          referee: 'A. Taylor',
          timezone: 'UTC',
          date: '2024-08-05T19:00:00+00:00',
          timestamp: 1722884400,
          periods: { first: 1722884400, second: 1722888000 },
          venue: { id: 525, name: 'Selhurst Park', city: 'London' },
          status: {
            long: 'Not Started',
            short: 'NS',
            elapsed: null,
            extra: null,
          },
        },
        league: {
          id: leagueId,
          name: 'Serie A',
          country: 'Italy',
          logo: 'https://media.api-sports.io/football/leagues/135.png',
          flag: 'https://media.api-sports.io/flags/it.svg',
          season,
          round: 'Regular Season - 1',
          standings: true,
        },
        teams: {
          home: {
            id: 496,
            name: 'Juventus',
            logo: 'https://media.api-sports.io/football/teams/496.png',
            winner: null,
          },
          away: {
            id: 505,
            name: 'Inter',
            logo: 'https://media.api-sports.io/football/teams/505.png',
            winner: null,
          },
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

const SA_COMPETITION_ROW = {
  id: 'comp-sa',
  leagueId: 135,
  code: 'SA',
  name: 'Serie A',
  country: 'Italy',
  isActive: true,
  csvDivisionCode: 'I1',
  seasonStartMonth: null,
  activeSeasonsCount: null,
  includeInBacktest: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('FixturesSyncWorker', () => {
  const fixtureService = {
    upsertCompetition: vi.fn().mockResolvedValue({ id: 'competition-id' }),
    upsertSeason: vi.fn().mockResolvedValue({ id: 'season-id' }),
    upsertFixtureChain: vi.fn().mockResolvedValue({ id: 'fixture-id' }),
  } satisfies Partial<FixtureService>;

  const config = {
    getOrThrow: vi.fn().mockReturnValue('test-api-key'),
  } satisfies Partial<ConfigService>;

  const notification = {
    sendEtlFailureAlert: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<NotificationService>;

  const prisma = {
    client: {
      competition: {
        findUnique: vi.fn().mockResolvedValue(SA_COMPETITION_ROW),
      },
    },
  };

  const worker = new FixturesSyncWorker(
    fixtureService as unknown as FixtureService,
    config as unknown as ConfigService,
    notification as unknown as NotificationService,
    prisma as unknown as PrismaService,
    {
      add: vi.fn().mockResolvedValue({}),
    } as unknown as Queue<InjuriesSyncJobData>,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    fixtureService.upsertCompetition.mockResolvedValue({
      id: 'competition-id',
    });
    fixtureService.upsertSeason.mockResolvedValue({ id: 'season-id' });
    fixtureService.upsertFixtureChain.mockResolvedValue({ id: 'fixture-id' });
    config.getOrThrow.mockReturnValue('test-api-key');
    prisma.client.competition.findUnique.mockResolvedValue(SA_COMPETITION_ROW);
  });

  it('enqueues injuries-sync after fixtures sync completes', async () => {
    const injuriesQueue = {
      add: vi.fn().mockResolvedValue({}),
    } as unknown as Queue<InjuriesSyncJobData>;

    const localWorker = new FixturesSyncWorker(
      fixtureService as unknown as FixtureService,
      config as unknown as ConfigService,
      notification as unknown as NotificationService,
      prisma as unknown as PrismaService,
      injuriesQueue,
    );

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(buildFixturesResponse(135, 2024)),
    });

    await localWorker.process({
      data: { competitionCode: 'SA', season: 2024, leagueId: 135 },
    } as Job<{ competitionCode: string; season: number; leagueId: number }>);

    expect(injuriesQueue.add).toHaveBeenCalledWith(
      'injuries-sync-SA-2024',
      { competitionCode: 'SA', season: 2024, leagueId: 135 },
      expect.any(Object),
    );
  });

  it('uses leagueId from job data to build API URL and upserts competition metadata', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(buildFixturesResponse(135, 2024)),
    });

    await worker.process({
      data: { competitionCode: 'SA', season: 2024, leagueId: 135 },
    } as Job<{ competitionCode: string; season: number; leagueId: number }>);

    expect(fetch).toHaveBeenCalledWith(
      'https://v3.football.api-sports.io/fixtures?league=135&season=2024',
      { headers: { 'x-apisports-key': 'test-api-key' } },
    );
    expect(fixtureService.upsertCompetition).toHaveBeenCalledWith({
      leagueId: 135,
      name: 'Serie A',
      code: 'SA',
      country: 'Italy',
      isActive: true,
      csvDivisionCode: 'I1',
      seasonStartMonth: undefined,
      activeSeasonsCount: undefined,
    });
    expect(fixtureService.upsertSeason).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionId: 'competition-id',
        name: '2024-25',
      }),
    );
    expect(fixtureService.upsertFixtureChain).toHaveBeenCalledTimes(1);
  });

  it('throws when API responds with non-ok status', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });

    await expect(
      worker.process({
        data: { competitionCode: 'SA', season: 2024, leagueId: 135 },
      } as Job<{ competitionCode: string; season: number; leagueId: number }>),
    ).rejects.toThrow('API-FOOTBALL responded 429 for season 2024');
  });

  it('throws when competitionCode is not found in DB', async () => {
    prisma.client.competition.findUnique.mockResolvedValue(null);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(buildFixturesResponse(135, 2024)),
    });

    await expect(
      worker.process({
        data: { competitionCode: 'UNKNOWN', season: 2024, leagueId: 99 },
      } as Job<{ competitionCode: string; season: number; leagueId: number }>),
    ).rejects.toThrow('Competition not found in DB: UNKNOWN');
  });

  it('skips the job when the competition is inactive', async () => {
    prisma.client.competition.findUnique.mockResolvedValue({
      ...SA_COMPETITION_ROW,
      isActive: false,
    });
    global.fetch = vi.fn();

    await worker.process({
      data: { competitionCode: 'SA', season: 2024, leagueId: 135 },
    } as Job<{ competitionCode: string; season: number; leagueId: number }>);

    expect(fetch).not.toHaveBeenCalled();
    expect(fixtureService.upsertCompetition).not.toHaveBeenCalled();
    expect(fixtureService.upsertFixtureChain).not.toHaveBeenCalled();
  });
});
