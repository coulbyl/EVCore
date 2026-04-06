import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFile } from 'node:child_process';
import type { Job } from 'bullmq';
import type { ConfigService } from '@nestjs/config';
import type { FixtureService } from '../../fixture/fixture.service';
import type { PrismaService } from '@/prisma.service';
import { InjuriesSyncWorker } from './injuries-sync.worker';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

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

function buildCurlStdout(body: unknown, status = 200) {
  return `${JSON.stringify(body)}\n__EVCORE_HTTP_CODE__:${status}`;
}

function mockCurlStdoutOnce(stdout: string) {
  vi.mocked(execFile).mockImplementationOnce(((_file, _args, cb) => {
    cb(null, stdout, '');
    return {} as never;
  }) as unknown as typeof execFile);
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
  includeInBacktest: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('InjuriesSyncWorker', () => {
  const TODAY_FIXTURE_DATE = new Date();
  TODAY_FIXTURE_DATE.setUTCHours(12, 0, 0, 0);
  const FAR_FIXTURE_DATE = new Date(TODAY_FIXTURE_DATE);
  FAR_FIXTURE_DATE.setUTCDate(FAR_FIXTURE_DATE.getUTCDate() + 4);

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
        scheduledAt: TODAY_FIXTURE_DATE,
        homeTeam: { externalId: 111 },
        awayTeam: { externalId: 222 },
      },
    ]);

    prisma.client.modelRun.findFirst.mockResolvedValue({
      id: 'run-1',
      features: { shadow_lineMovement: 0.05 },
    });

    mockCurlStdoutOnce(buildCurlStdout(buildInjuriesResponse(999)));

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
        scheduledAt: TODAY_FIXTURE_DATE,
        homeTeam: { externalId: 111 },
        awayTeam: { externalId: 222 },
      },
    ]);

    prisma.client.modelRun.findFirst.mockResolvedValue(null);
    mockCurlStdoutOnce(buildCurlStdout(buildInjuriesResponse(999)));

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
        scheduledAt: TODAY_FIXTURE_DATE,
        homeTeam: { externalId: 111 },
        awayTeam: { externalId: 222 },
      },
    ]);

    mockCurlStdoutOnce(buildCurlStdout({}, 429));

    await worker.process({
      data: { season: 2025, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    expect(prisma.client.modelRun.findFirst).not.toHaveBeenCalled();
  });

  it('throws when competitionCode is not found in DB', async () => {
    prisma.client.competition.findFirst.mockResolvedValue(null);
    vi.mocked(execFile).mockReset();

    await expect(
      worker.process({
        data: { season: 2025, competitionCode: 'UNKNOWN', leagueId: 0 },
      } as Job<{ season: number; competitionCode: string; leagueId: number }>),
    ).rejects.toThrow('Competition not found in DB: UNKNOWN');

    expect(execFile).not.toHaveBeenCalled();
  });

  it('skips the job when the competition is inactive', async () => {
    prisma.client.competition.findFirst.mockResolvedValue({
      ...PL_COMPETITION_ROW,
      isActive: false,
    });
    vi.mocked(execFile).mockReset();

    await worker.process({
      data: { season: 2025, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    expect(execFile).not.toHaveBeenCalled();
    expect(fixtureService.upsertCompetition).not.toHaveBeenCalled();
    expect(prisma.client.modelRun.findFirst).not.toHaveBeenCalled();
  });

  it('ignores scheduled fixtures beyond tomorrow UTC', async () => {
    fixtureService.findScheduledBySeason.mockResolvedValue([
      {
        id: 'fixture-near',
        externalId: 999,
        scheduledAt: TODAY_FIXTURE_DATE,
        homeTeam: { externalId: 111 },
        awayTeam: { externalId: 222 },
      },
      {
        id: 'fixture-far',
        externalId: 1000,
        scheduledAt: FAR_FIXTURE_DATE,
        homeTeam: { externalId: 111 },
        awayTeam: { externalId: 222 },
      },
    ]);

    prisma.client.modelRun.findFirst.mockResolvedValue({
      id: 'run-1',
      features: { shadow_lineMovement: 0.05 },
    });

    mockCurlStdoutOnce(buildCurlStdout(buildInjuriesResponse(999)));

    await worker.process({
      data: { season: 2025, competitionCode: 'PL', leagueId: 39 },
    } as Job<{ season: number; competitionCode: string; leagueId: number }>);

    expect(execFile).toHaveBeenCalledTimes(1);
    expect(execFile).toHaveBeenCalledWith(
      'curl',
      expect.arrayContaining([
        '--silent',
        '--show-error',
        '--location',
        '-H',
        'x-apisports-key: test-api-key',
        'https://v3.football.api-sports.io/injuries?fixture=999',
      ]),
      expect.any(Function),
    );
  });
});
