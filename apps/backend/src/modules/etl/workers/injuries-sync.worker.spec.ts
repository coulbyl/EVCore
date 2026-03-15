import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { ConfigService } from '@nestjs/config';
import type { FixtureService } from '../../fixture/fixture.service';
import type { PrismaService } from '@/prisma.service';
import { InjuriesSyncWorker } from './injuries-sync.worker';

function buildInjuriesResponse(fixtureId: number) {
  return {
    get: 'injuries',
    parameters: { fixture: String(fixtureId) },
    errors: [],
    results: 2,
    paging: { current: 1, total: 1 },
    response: [
      {
        team: { id: 111, name: 'Home FC' },
        player: { id: 1, name: 'Home Player 1' },
        fixture: { id: fixtureId },
        type: 'Missing Fixture',
        reason: 'Muscle Injury',
      },
      {
        team: { id: 222, name: 'Away FC' },
        player: { id: 2, name: 'Away Player 1' },
        fixture: { id: fixtureId },
        type: 'Missing Fixture',
        reason: 'Knee Injury',
      },
    ],
  };
}

const PL_COMPETITION_ROW = {
  id: 'comp-pl',
  leagueId: 39,
  code: 'PL',
  name: 'Premier League',
  country: 'England',
  isActive: true,
  csvDivisionCode: 'E0',
  seasonStartMonth: null,
  activeSeasonsCount: null,
  includeInBacktest: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('InjuriesSyncWorker', () => {
  const fixtureService = {
    upsertCompetition: vi.fn().mockResolvedValue({ id: 'competition-id' }),
    upsertSeason: vi.fn().mockResolvedValue({ id: 'season-id' }),
    findScheduledBySeason: vi.fn(),
  } satisfies Partial<FixtureService>;

  const config = {
    getOrThrow: vi.fn().mockReturnValue('test-api-key'),
  } satisfies Partial<ConfigService>;

  const prisma = {
    client: {
      competition: {
        findFirst: vi.fn().mockResolvedValue(PL_COMPETITION_ROW),
      },
      modelRun: {
        findFirst: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    },
  };

  const worker = new InjuriesSyncWorker(
    fixtureService as unknown as FixtureService,
    config as unknown as ConfigService,
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    fixtureService.upsertCompetition.mockResolvedValue({
      id: 'competition-id',
    });
    fixtureService.upsertSeason.mockResolvedValue({ id: 'season-id' });
    config.getOrThrow.mockReturnValue('test-api-key');
    prisma.client.competition.findFirst.mockResolvedValue(PL_COMPETITION_ROW);
  });

  it('stores shadow_injuries in latest model run features', async () => {
    fixtureService.findScheduledBySeason.mockResolvedValue([
      {
        id: 'fixture-1',
        externalId: 999,
        homeTeam: { externalId: 111 },
        awayTeam: { externalId: 222 },
      },
    ]);

    prisma.client.modelRun.findFirst.mockResolvedValue({
      id: 'run-1',
      features: { shadow_lineMovement: 0.05 },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(buildInjuriesResponse(999)),
    });

    await worker.process({
      data: { season: 2025, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    expect(prisma.client.modelRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: {
        features: {
          shadow_lineMovement: 0.05,
          shadow_injuries: { home: 1, away: 1, total: 2 },
        },
      },
    });
  });

  it('skips modelRun update when no model run exists for fixture', async () => {
    fixtureService.findScheduledBySeason.mockResolvedValue([
      {
        id: 'fixture-1',
        externalId: 999,
        homeTeam: { externalId: 111 },
        awayTeam: { externalId: 222 },
      },
    ]);

    prisma.client.modelRun.findFirst.mockResolvedValue(null);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(buildInjuriesResponse(999)),
    });

    await worker.process({
      data: { season: 2025, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    expect(prisma.client.modelRun.update).not.toHaveBeenCalled();
  });

  it('skips fixture when injuries endpoint returns non-ok status', async () => {
    fixtureService.findScheduledBySeason.mockResolvedValue([
      {
        id: 'fixture-1',
        externalId: 999,
        homeTeam: { externalId: 111 },
        awayTeam: { externalId: 222 },
      },
    ]);

    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });

    await worker.process({
      data: { season: 2025, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    expect(prisma.client.modelRun.findFirst).not.toHaveBeenCalled();
  });

  it('throws when competitionCode is not found in DB', async () => {
    prisma.client.competition.findFirst.mockResolvedValue(null);
    global.fetch = vi.fn();

    await expect(
      worker.process({
        data: { season: 2025, competitionCode: 'UNKNOWN', leagueId: 0 },
      } as Job<{ season: number; competitionCode: string; leagueId: number }>),
    ).rejects.toThrow('Competition not found in DB: UNKNOWN');

    expect(fetch).not.toHaveBeenCalled();
  });

  it('skips the job when the competition is inactive', async () => {
    prisma.client.competition.findFirst.mockResolvedValue({
      ...PL_COMPETITION_ROW,
      isActive: false,
    });
    global.fetch = vi.fn();

    await worker.process({
      data: { season: 2025, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    expect(fetch).not.toHaveBeenCalled();
    expect(fixtureService.upsertCompetition).not.toHaveBeenCalled();
    expect(prisma.client.modelRun.findFirst).not.toHaveBeenCalled();
  });
});
