import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractXg, StatsSyncWorker } from './stats-sync.worker';
import type { FixtureService } from '../../fixture/fixture.service';
import type { ConfigService } from '@nestjs/config';
import { ApiFootballClient } from '../api-football.client';
import type { NotificationService } from '../../notification/notification.service';
import type { PrismaService } from '@/prisma.service';
import type { Job } from 'bullmq';
import type { RollingStatsService } from '../../rolling-stats/rolling-stats.service';
import type { FixtureStatisticsService } from '../../fixture-statistics/fixture-statistics.service';
import type { FixtureEventsService } from '../../fixture-events/fixture-events.service';
import { XgSource } from '@evcore/db';
import { execFile } from 'node:child_process';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('@utils/async.utils', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
}));

type TeamStats = { team: { id: number; name: string }; statistics: unknown[] };

// One /fixtures?ids= entry: teams 33 (home) / 40 (away) unless told otherwise.
function entry(
  externalId: number,
  opts: {
    statistics?: TeamStats[];
    homeId?: number;
    awayId?: number;
    details?: Record<string, unknown>;
  } = {},
) {
  const homeId = opts.homeId ?? 33;
  const awayId = opts.awayId ?? 40;
  return {
    fixture: { id: externalId },
    teams: { home: { id: homeId }, away: { id: awayId } },
    statistics: opts.statistics ?? teamStats('0.76', '1.23'),
    events: [
      {
        time: { elapsed: 12, extra: null },
        team: { id: homeId, name: 'Home' },
        player: { id: 7, name: 'Scorer' },
        assist: { id: null, name: null },
        type: 'Goal',
        detail: 'Normal Goal',
        comments: null,
      },
    ],
    lineups: [],
    players: [],
    ...opts.details,
  };
}

function teamStats(homeXg: string | null, awayXg: string | null): TeamStats[] {
  return [
    {
      team: { id: 33, name: 'Manchester United' },
      statistics: [
        { type: 'Shots on Goal', value: 5 },
        { type: 'expected_goals', value: homeXg },
      ],
    },
    {
      team: { id: 40, name: 'Liverpool' },
      statistics: [
        { type: 'Shots on Goal', value: 3 },
        { type: 'expected_goals', value: awayXg },
      ],
    },
  ];
}

function fixturesAnswer(entries: unknown[]) {
  return {
    get: 'fixtures',
    parameters: { ids: '' },
    errors: [],
    results: entries.length,
    response: entries,
  };
}

const LEAGUES_EMPTY = {
  get: 'leagues',
  parameters: {},
  errors: [],
  results: 0,
  response: [],
};

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

function fixtureWithoutStatistics(
  externalId: number,
  homeExternalId = 33,
  awayExternalId = 40,
) {
  return {
    externalId,
    homeTeam: { externalId: homeExternalId },
    awayTeam: { externalId: awayExternalId },
  };
}

describe('StatsSyncWorker', () => {
  const execFileMock = vi.mocked(execFile);
  const fixtureService = {
    upsertCompetition: vi.fn().mockResolvedValue({ id: 'competition-id' }),
    upsertSeason: vi.fn().mockResolvedValue({ id: 'season-id' }),
    findFinishedWithoutStatistics: vi.fn(),
    updateXg: vi.fn().mockResolvedValue(undefined),
    markXgUnavailable: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<FixtureService>;

  const config = {
    getOrThrow: vi.fn().mockReturnValue('test-api-key'),
    get: vi.fn().mockReturnValue(undefined),
  } satisfies Partial<ConfigService>;

  const notification = {
    sendEtlFailureAlert: vi.fn().mockResolvedValue(undefined),
    sendXgUnavailableReport: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<NotificationService>;

  const rollingStatsService = {
    backfillSeason: vi.fn(),
  } satisfies Partial<RollingStatsService>;

  const fixtureStatistics = {
    persistFinalStatistics: vi.fn(),
    markUnavailable: vi.fn(),
  } satisfies Partial<FixtureStatisticsService>;

  const fixtureEvents = {
    persistDetails: vi.fn(),
  } satisfies Partial<FixtureEventsService>;

  const prisma = {
    client: {
      competition: {
        findFirst: vi.fn().mockResolvedValue(PL_COMPETITION_ROW),
      },
    },
  };

  const apiFootball = new ApiFootballClient(config as unknown as ConfigService);

  const worker = new StatsSyncWorker(
    fixtureService as unknown as FixtureService,
    apiFootball,
    notification as unknown as NotificationService,
    prisma as unknown as PrismaService,
    rollingStatsService as unknown as RollingStatsService,
    fixtureStatistics as unknown as FixtureStatisticsService,
    fixtureEvents as unknown as FixtureEventsService,
  );

  const JOB = {
    data: { season: 2022, competitionCode: 'PL', leagueId: 39 },
  } as Job<{ season: number; competitionCode: string; leagueId: number }>;

  // Answers /leagues with an empty list and every /fixtures?ids= call with
  // `answer(ids)`; records the ids asked.
  function serve(
    answer: (ids: number[]) => { body: unknown; status?: number },
  ): number[][] {
    const asked: number[][] = [];
    execFileMock.mockImplementation((...args) => {
      const curlArgs = args[1] as string[];
      const url = curlArgs[curlArgs.length - 1] ?? '';
      const callback = args[args.length - 1] as (
        error: Error | null,
        stdout: string,
      ) => void;
      const match = /fixtures\?ids=([\d-]+)/.exec(url);
      if (!match?.[1]) {
        callback(
          null,
          `${JSON.stringify(LEAGUES_EMPTY)}\n__EVCORE_HTTP_CODE__:200`,
        );
        return {} as never;
      }
      const ids = match[1].split('-').map(Number);
      asked.push(ids);
      const { body, status = 200 } = answer(ids);
      callback(
        null,
        `${typeof body === 'string' ? body : JSON.stringify(body)}\n__EVCORE_HTTP_CODE__:${status}`,
      );
      return {} as never;
    });
    return asked;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    fixtureService.upsertCompetition.mockResolvedValue({
      id: 'competition-id',
    });
    fixtureService.upsertSeason.mockResolvedValue({ id: 'season-id' });
    fixtureService.updateXg.mockResolvedValue(undefined);
    fixtureService.markXgUnavailable.mockResolvedValue(undefined);
    fixtureStatistics.persistFinalStatistics.mockResolvedValue(4);
    fixtureStatistics.markUnavailable.mockResolvedValue(undefined);
    fixtureEvents.persistDetails.mockResolvedValue({
      status: 'written',
      events: 1,
      lineups: 0,
      playerStatistics: 0,
      synced: false,
    });
    rollingStatsService.backfillSeason.mockResolvedValue({
      seasonId: 'season-id',
      fixtureCount: 1,
      upsertCount: 2,
      teamStatsWritten: 2,
      createdCount: 2,
      updatedCount: 0,
      durationMs: 1,
    });
    config.getOrThrow.mockReturnValue('test-api-key');
    config.get.mockReturnValue(undefined);
    prisma.client.competition.findFirst.mockResolvedValue(PL_COMPETITION_ROW);
    execFileMock.mockReset();
  });

  it('aborts on a 429 without marking anything', async () => {
    fixtureService.findFinishedWithoutStatistics.mockResolvedValue([
      fixtureWithoutStatistics(12345),
    ]);
    serve(() => ({ body: { errors: { rate: 'limited' } }, status: 429 }));

    await worker.process(JOB);

    expect(fixtureService.updateXg).not.toHaveBeenCalled();
    expect(fixtureService.markXgUnavailable).not.toHaveBeenCalled();
    expect(fixtureEvents.persistDetails).not.toHaveBeenCalled();
    expect(rollingStatsService.backfillSeason).not.toHaveBeenCalled();
  });

  it('aborts on an exhausted daily quota without marking fixtures unavailable', async () => {
    const asked = serve(() => ({
      body: {
        get: 'fixtures',
        parameters: { ids: '55501-55502' },
        errors: { requests: 'You have reached the request limit' },
        results: 0,
        response: [],
      },
    }));

    const result = await worker.syncFixtures([
      fixtureWithoutStatistics(55501),
      fixtureWithoutStatistics(55502),
    ]);

    expect(result).toMatchObject({
      abortReason: 'quota',
      updated: 0,
      statisticsUnavailable: 0,
      calls: 1,
    });
    expect(asked).toEqual([[55501, 55502]]);
    expect(fixtureService.markXgUnavailable).not.toHaveBeenCalled();
    expect(fixtureStatistics.markUnavailable).not.toHaveBeenCalled();
  });

  it('asks 20 fixtures per call and keeps what came before a quota stop', async () => {
    const fixtures = Array.from({ length: 45 }, (_, i) =>
      fixtureWithoutStatistics(1000 + i),
    );
    let call = 0;
    const asked = serve((ids) => {
      call++;
      if (call === 3) {
        return {
          body: {
            get: 'fixtures',
            errors: { requests: 'limit' },
            response: [],
          },
        };
      }
      return { body: fixturesAnswer(ids.map((id) => entry(id))) };
    });

    const result = await worker.syncFixtures(fixtures);

    expect(asked.map((ids) => ids.length)).toEqual([20, 20, 5]);
    expect(asked[1]?.[0]).toBe(1020);
    expect(result).toMatchObject({
      abortReason: 'quota',
      updated: 40,
      calls: 3,
      details: { written: 40 },
    });
    expect(fixtureService.markXgUnavailable).not.toHaveBeenCalled();
  });

  it('writes statistics, xG and events of every fixture of the answer', async () => {
    fixtureService.findFinishedWithoutStatistics.mockResolvedValue([
      fixtureWithoutStatistics(99999),
    ]);
    serve((ids) => ({ body: fixturesAnswer(ids.map((id) => entry(id))) }));

    await worker.process(JOB);

    expect(fixtureService.updateXg).toHaveBeenCalledWith({
      externalId: 99999,
      homeXg: 0.76,
      awayXg: 1.23,
      homeXgSource: XgSource.API_FOOTBALL,
      awayXgSource: XgSource.API_FOOTBALL,
    });
    expect(fixtureStatistics.persistFinalStatistics).toHaveBeenCalledWith(
      expect.objectContaining({
        fixtureExternalId: 99999,
        teams: [
          expect.objectContaining({ externalTeamId: 33 }),
          expect.objectContaining({ externalTeamId: 40 }),
        ],
      }),
    );
    expect(fixtureEvents.persistDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        fixtureExternalId: 99999,
        details: expect.objectContaining({
          events: [expect.objectContaining({ detail: 'Normal Goal' })],
        }),
      }),
    );
    expect(rollingStatsService.backfillSeason).toHaveBeenCalledWith(
      'season-id',
    );
  });

  it('matches home and away xG by provider team id, not response order', async () => {
    fixtureService.findFinishedWithoutStatistics.mockResolvedValue([
      fixtureWithoutStatistics(99998),
    ]);
    serve((ids) => ({
      body: fixturesAnswer(
        ids.map((id) =>
          entry(id, { statistics: teamStats('0.76', '1.23').reverse() }),
        ),
      ),
    }));

    await worker.process(JOB);

    expect(fixtureService.updateXg).toHaveBeenCalledWith(
      expect.objectContaining({ homeXg: 0.76, awayXg: 1.23 }),
    );
  });

  it('falls back to shots proxy when expected_goals field is present but null', async () => {
    fixtureService.findFinishedWithoutStatistics.mockResolvedValue([
      fixtureWithoutStatistics(11111),
    ]);
    serve((ids) => ({
      body: fixturesAnswer(
        ids.map((id) => entry(id, { statistics: teamStats(null, null) })),
      ),
    }));

    await worker.process(JOB);

    // Proxy: shots_on_goal × 0.40 — home: 5×0.40=2.00, away: 3×0.40=1.20
    expect(fixtureService.updateXg).toHaveBeenCalledWith({
      externalId: 11111,
      homeXg: expect.closeTo(2.0),
      awayXg: expect.closeTo(1.2),
      homeXgSource: XgSource.SHOTS_PROXY,
      awayXgSource: XgSource.SHOTS_PROXY,
    });
    expect(fixtureService.markXgUnavailable).not.toHaveBeenCalled();
  });

  it('falls back to shots proxy when expected_goals field is absent', async () => {
    fixtureService.findFinishedWithoutStatistics.mockResolvedValue([
      fixtureWithoutStatistics(44444, 52, 42),
    ]);
    // Response without expected_goals field (2022-23 first half pattern)
    serve((ids) => ({
      body: fixturesAnswer(
        ids.map((id) =>
          entry(id, {
            homeId: 52,
            awayId: 42,
            statistics: [
              {
                team: { id: 52, name: 'Crystal Palace' },
                statistics: [{ type: 'Shots on Goal', value: 2 }],
              },
              {
                team: { id: 42, name: 'Arsenal' },
                statistics: [{ type: 'Shots on Goal', value: 5 }],
              },
            ],
          }),
        ),
      ),
    }));

    await worker.process(JOB);

    // Proxy: shots_on_goal × 0.40 — home: 2×0.40=0.80, away: 5×0.40=2.00
    expect(fixtureService.updateXg).toHaveBeenCalledWith({
      externalId: 44444,
      homeXg: 0.8,
      awayXg: 2.0,
      homeXgSource: XgSource.SHOTS_PROXY,
      awayXgSource: XgSource.SHOTS_PROXY,
    });
  });

  it('calls only /leagues when no fixture is pending', async () => {
    fixtureService.findFinishedWithoutStatistics.mockResolvedValue([]);
    const asked = serve(() => ({ body: fixturesAnswer([]) }));

    await worker.process(JOB);

    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(asked).toEqual([]);
    expect(rollingStatsService.backfillSeason).not.toHaveBeenCalled();
  });

  it('skips the job when the competition is inactive', async () => {
    prisma.client.competition.findFirst.mockResolvedValue({
      ...PL_COMPETITION_ROW,
      isActive: false,
    });

    await worker.process(JOB);

    expect(fixtureService.upsertCompetition).not.toHaveBeenCalled();
    expect(fixtureService.findFinishedWithoutStatistics).not.toHaveBeenCalled();
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('marks statistics unavailable with fewer than 2 teams, still writes the events', async () => {
    fixtureService.findFinishedWithoutStatistics.mockResolvedValue([
      fixtureWithoutStatistics(33333),
    ]);
    serve((ids) => ({
      body: fixturesAnswer(
        ids.map((id) =>
          entry(id, {
            statistics: [
              {
                team: { id: 33, name: 'Manchester United' },
                statistics: [{ type: 'Shots on Goal', value: 5 }],
              },
            ],
          }),
        ),
      ),
    }));

    await worker.process(JOB);

    expect(fixtureService.markXgUnavailable).toHaveBeenCalledWith(33333);
    expect(fixtureStatistics.markUnavailable).toHaveBeenCalledWith(33333);
    expect(fixtureService.updateXg).not.toHaveBeenCalled();
    expect(fixtureEvents.persistDetails).toHaveBeenCalledOnce();
    expect(rollingStatsService.backfillSeason).not.toHaveBeenCalled();
  });

  it('marks statistics unavailable when their teams are not the fixture', async () => {
    serve((ids) => ({
      body: fixturesAnswer(ids.map((id) => entry(id))),
    }));

    const result = await worker.syncFixtures([
      fixtureWithoutStatistics(22222, 33, 99),
    ]);

    expect(result.statisticsUnavailable).toBe(1);
    expect(fixtureStatistics.markUnavailable).toHaveBeenCalledWith(22222);
  });

  it('leaves a fixture missing from the answer pending, never unavailable', async () => {
    serve((ids) => ({ body: fixturesAnswer([entry(ids[0] ?? 0)]) }));

    const result = await worker.syncFixtures([
      fixtureWithoutStatistics(70001),
      fixtureWithoutStatistics(70002),
    ]);

    expect(result).toMatchObject({
      updated: 1,
      skipped: 1,
      failedExternalIds: [70002],
      details: { written: 1, failedExternalIds: [70002] },
    });
    expect(fixtureService.markXgUnavailable).not.toHaveBeenCalled();
    expect(fixtureStatistics.markUnavailable).not.toHaveBeenCalled();
  });

  it('rejects a malformed answer as a whole: nothing written, nothing marked', async () => {
    serve(() => ({ body: { get: 'fixtures', response: 'oops' } }));

    const result = await worker.syncFixtures([
      fixtureWithoutStatistics(80001),
      fixtureWithoutStatistics(80002),
    ]);

    expect(result).toMatchObject({
      updated: 0,
      skipped: 2,
      failedExternalIds: [80001, 80002],
    });
    expect(fixtureStatistics.persistFinalStatistics).not.toHaveBeenCalled();
    expect(fixtureStatistics.markUnavailable).not.toHaveBeenCalled();
    expect(fixtureEvents.persistDetails).not.toHaveBeenCalled();
  });

  it('keeps the team statistics when the events block of a match is malformed', async () => {
    serve((ids) => ({
      body: fixturesAnswer([
        entry(ids[0] ?? 0, { details: { lineups: 'oops' } }),
        entry(ids[1] ?? 0),
      ]),
    }));

    const result = await worker.syncFixtures([
      fixtureWithoutStatistics(81001),
      fixtureWithoutStatistics(81002),
    ]);

    expect(result.updated).toBe(2);
    expect(result.details).toMatchObject({
      written: 1,
      rejected: 1,
      failedExternalIds: [81001],
    });
    expect(fixtureEvents.persistDetails).toHaveBeenCalledOnce();
    expect(fixtureStatistics.markUnavailable).not.toHaveBeenCalled();
  });

  it('leaves statistics alone in details-only mode', async () => {
    serve((ids) => ({ body: fixturesAnswer(ids.map((id) => entry(id))) }));

    const result = await worker.syncFixtures(
      [fixtureWithoutStatistics(90001)],
      'details-only',
    );

    expect(result).toMatchObject({ updated: 0, details: { written: 1 } });
    expect(fixtureService.updateXg).not.toHaveBeenCalled();
    expect(fixtureStatistics.persistFinalStatistics).not.toHaveBeenCalled();
    expect(fixtureStatistics.markUnavailable).not.toHaveBeenCalled();
  });

  it('the routine leaves a fixture alone after three misses, never unavailable', async () => {
    fixtureService.findFinishedWithoutStatistics.mockResolvedValue([
      fixtureWithoutStatistics(71001),
      fixtureWithoutStatistics(71002),
    ]);
    // 71001 never comes back in the answer.
    const asked = serve((ids) => ({
      body: fixturesAnswer(
        ids.filter((id) => id !== 71001).map((id) => entry(id)),
      ),
    }));
    const routine = new StatsSyncWorker(
      fixtureService as unknown as FixtureService,
      apiFootball,
      notification as unknown as NotificationService,
      prisma as unknown as PrismaService,
      rollingStatsService as unknown as RollingStatsService,
      fixtureStatistics as unknown as FixtureStatisticsService,
      fixtureEvents as unknown as FixtureEventsService,
    );

    for (let run = 0; run < 4; run++) await routine.process(JOB);

    expect(asked.slice(0, 3)).toEqual([
      [71001, 71002],
      [71001, 71002],
      [71001, 71002],
    ]);
    expect(asked[3]).toEqual([71002]);
    expect(fixtureStatistics.markUnavailable).not.toHaveBeenCalled();
  });

  it('a failed events write never costs the other fixtures their statistics', async () => {
    fixtureEvents.persistDetails
      .mockRejectedValueOnce(new Error('deadlock'))
      .mockResolvedValue({
        status: 'written',
        events: 1,
        lineups: 0,
        playerStatistics: 0,
        synced: true,
      });
    serve((ids) => ({ body: fixturesAnswer(ids.map((id) => entry(id))) }));

    const result = await worker.syncFixtures([
      fixtureWithoutStatistics(72001),
      fixtureWithoutStatistics(72002),
    ]);

    expect(result.updated).toBe(2);
    expect(result.details).toMatchObject({
      written: 1,
      rejected: 1,
      failedExternalIds: [72001],
    });
  });

  it('alerts once a day on rejected answers', async () => {
    serve((ids) => ({
      body: fixturesAnswer(
        ids.map((id) => entry(id, { details: { players: 'oops' } })),
      ),
    }));
    const alerting = new StatsSyncWorker(
      fixtureService as unknown as FixtureService,
      apiFootball,
      notification as unknown as NotificationService,
      prisma as unknown as PrismaService,
      rollingStatsService as unknown as RollingStatsService,
      fixtureStatistics as unknown as FixtureStatisticsService,
      fixtureEvents as unknown as FixtureEventsService,
    );

    await alerting.syncFixtures([fixtureWithoutStatistics(73001)]);
    await alerting.syncFixtures([fixtureWithoutStatistics(73002)]);

    expect(notification.sendEtlFailureAlert).toHaveBeenCalledOnce();
    expect(notification.sendEtlFailureAlert.mock.calls[0]?.[2]).toContain(
      '1 match(es)',
    );
  });

  it('skips a batch on a network error, leaving it pending', async () => {
    execFileMock.mockImplementation((...args) => {
      const callback = args[args.length - 1] as (error: Error | null) => void;
      callback(Object.assign(new Error('Operation timed out'), { code: 28 }));
      return {} as never;
    });

    const result = await worker.syncFixtures([fixtureWithoutStatistics(91001)]);

    expect(result).toMatchObject({
      skipped: 1,
      failedExternalIds: [91001],
      abortReason: null,
    });
  });
});

describe('extractXg', () => {
  it('ne transforme pas une absence de xG et de tirs cadrés en faux xG nul', () => {
    expect(extractXg([{ type: 'Corner Kicks', value: 4 }])).toBeNull();
  });

  it('trace explicitement la provenance du proxy tirs cadrés', () => {
    expect(extractXg([{ type: 'Shots on Goal', value: 5 }])).toEqual({
      value: 2,
      source: XgSource.SHOTS_PROXY,
    });
  });
});
