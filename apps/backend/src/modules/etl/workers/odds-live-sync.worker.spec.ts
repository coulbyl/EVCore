import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OddsLiveSyncWorker,
  extractOneXTwoOdds,
} from './odds-live-sync.worker';
import type { FixtureService } from '../../fixture/fixture.service';
import type { ConfigService } from '@nestjs/config';
import type { NotificationService } from '../../notification/notification.service';
import type { Job } from 'bullmq';
import type { OddsLiveSyncJobData } from './odds-live-sync.worker';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function buildOddsApiResponse(externalId: number, bookmakers: unknown[] = []) {
  return {
    response: [
      {
        fixture: { id: externalId },
        update: '2026-03-02T18:00:00+00:00',
        bookmakers,
      },
    ],
  };
}

function pinnacleBookmaker(home: string, draw: string, away: string) {
  return {
    id: 4,
    name: 'Pinnacle',
    bets: [
      {
        id: 1,
        name: 'Match Winner',
        values: [
          { value: 'Home', odd: home },
          { value: 'Draw', odd: draw },
          { value: 'Away', odd: away },
        ],
      },
    ],
  };
}

function bet365Bookmaker(home: string, draw: string, away: string) {
  return {
    id: 8,
    name: 'Bet365',
    bets: [
      {
        id: 1,
        name: 'Match Winner',
        values: [
          { value: 'Home', odd: home },
          { value: 'Draw', odd: draw },
          { value: 'Away', odd: away },
        ],
      },
    ],
  };
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const fixtureService = {
  findScheduledForDate: vi.fn(),
  upsertOddsSnapshot: vi.fn().mockResolvedValue({ id: 'snap-id' }),
} satisfies Partial<FixtureService>;

const config = {
  getOrThrow: vi.fn().mockReturnValue('test-api-key'),
} satisfies Partial<ConfigService>;

const notification = {
  sendEtlFailureAlert: vi.fn().mockResolvedValue(undefined),
} satisfies Partial<NotificationService>;

const worker = new OddsLiveSyncWorker(
  fixtureService as unknown as FixtureService,
  config as unknown as ConfigService,
  notification as unknown as NotificationService,
);

const makeJob = (data: OddsLiveSyncJobData = {}) =>
  ({
    data,
    opts: { attempts: 3 },
    attemptsMade: 0,
  }) as Job<OddsLiveSyncJobData>;

beforeEach(() => {
  vi.clearAllMocks();
  config.getOrThrow.mockReturnValue('test-api-key');
  fixtureService.upsertOddsSnapshot.mockResolvedValue({ id: 'snap-id' });
  // Skip the 6s rate-limit sleep so tests don't time out
  vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn) => {
    if (typeof fn === 'function') fn();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  });
});

// ─── Worker.process ───────────────────────────────────────────────────────────

describe('OddsLiveSyncWorker.process', () => {
  it('does nothing when no scheduled fixtures for the date', async () => {
    fixtureService.findScheduledForDate.mockResolvedValue([]);
    global.fetch = vi.fn();

    await worker.process(makeJob({ date: '2026-03-03' }));

    expect(fetch).not.toHaveBeenCalled();
    expect(fixtureService.upsertOddsSnapshot).not.toHaveBeenCalled();
  });

  it('upserts a Pinnacle snapshot when Pinnacle is available', async () => {
    fixtureService.findScheduledForDate.mockResolvedValue([
      { id: 'fixture-uuid', externalId: 1379250 },
    ]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi
        .fn()
        .mockResolvedValue(
          buildOddsApiResponse(1379250, [
            pinnacleBookmaker('2.10', '3.40', '4.20'),
          ]),
        ),
    });

    await worker.process(makeJob({ date: '2026-03-03' }));

    expect(fixtureService.upsertOddsSnapshot).toHaveBeenCalledOnce();
    expect(fixtureService.upsertOddsSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        fixtureId: 'fixture-uuid',
        bookmaker: 'Pinnacle',
        homeOdds: 2.1,
        drawOdds: 3.4,
        awayOdds: 4.2,
      }),
    );
  });

  it('falls back to Bet365 when Pinnacle is absent', async () => {
    fixtureService.findScheduledForDate.mockResolvedValue([
      { id: 'fixture-uuid', externalId: 1379250 },
    ]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi
        .fn()
        .mockResolvedValue(
          buildOddsApiResponse(1379250, [
            bet365Bookmaker('2.00', '3.30', '4.00'),
          ]),
        ),
    });

    await worker.process(makeJob({ date: '2026-03-03' }));

    expect(fixtureService.upsertOddsSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ bookmaker: 'Bet365' }),
    );
  });

  it('prefers Pinnacle over Bet365 when both are present', async () => {
    fixtureService.findScheduledForDate.mockResolvedValue([
      { id: 'fixture-uuid', externalId: 1379250 },
    ]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi
        .fn()
        .mockResolvedValue(
          buildOddsApiResponse(1379250, [
            pinnacleBookmaker('2.08', '3.38', '4.15'),
            bet365Bookmaker('2.10', '3.40', '4.20'),
          ]),
        ),
    });

    await worker.process(makeJob({ date: '2026-03-03' }));

    expect(fixtureService.upsertOddsSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ bookmaker: 'Pinnacle', homeOdds: 2.08 }),
    );
  });

  it('skips fixture when API returns non-ok status', async () => {
    fixtureService.findScheduledForDate.mockResolvedValue([
      { id: 'fixture-uuid', externalId: 99999 },
    ]);

    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });

    await worker.process(makeJob({ date: '2026-03-03' }));

    expect(fixtureService.upsertOddsSnapshot).not.toHaveBeenCalled();
  });

  it('skips fixture when Zod validation fails', async () => {
    fixtureService.findScheduledForDate.mockResolvedValue([
      { id: 'fixture-uuid', externalId: 12345 },
    ]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ response: [{ bad: 'data' }] }),
    });

    await worker.process(makeJob({ date: '2026-03-03' }));

    expect(fixtureService.upsertOddsSnapshot).not.toHaveBeenCalled();
  });

  it('skips fixture when no odds data in response', async () => {
    fixtureService.findScheduledForDate.mockResolvedValue([
      { id: 'fixture-uuid', externalId: 12345 },
    ]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ response: [] }),
    });

    await worker.process(makeJob({ date: '2026-03-03' }));

    expect(fixtureService.upsertOddsSnapshot).not.toHaveBeenCalled();
  });

  it('skips fixture when neither Pinnacle nor Bet365 has Match Winner data', async () => {
    fixtureService.findScheduledForDate.mockResolvedValue([
      { id: 'fixture-uuid', externalId: 12345 },
    ]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi
        .fn()
        .mockResolvedValue(
          buildOddsApiResponse(12345, [
            { id: 7, name: 'William Hill', bets: [] },
          ]),
        ),
    });

    await worker.process(makeJob({ date: '2026-03-03' }));

    expect(fixtureService.upsertOddsSnapshot).not.toHaveBeenCalled();
  });

  it('processes multiple fixtures and counts synced/skipped correctly', async () => {
    fixtureService.findScheduledForDate.mockResolvedValue([
      { id: 'uuid-1', externalId: 111 },
      { id: 'uuid-2', externalId: 222 },
    ]);

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue(
            buildOddsApiResponse(111, [
              pinnacleBookmaker('1.80', '3.50', '5.00'),
            ]),
          ),
      })
      .mockResolvedValueOnce({ ok: false, status: 503 });

    await worker.process(makeJob({ date: '2026-03-03' }));

    expect(fixtureService.upsertOddsSnapshot).toHaveBeenCalledOnce();
  });
});

// ─── extractOneXTwoOdds ───────────────────────────────────────────────────────

describe('extractOneXTwoOdds', () => {
  it('returns null when bookmakers array is empty', () => {
    expect(extractOneXTwoOdds([])).toBeNull();
  });

  it('returns null when no Pinnacle or Bet365 bookmaker', () => {
    const bk = {
      id: 7,
      name: 'William Hill',
      bets: [
        {
          id: 1,
          name: 'Match Winner',
          values: [
            { value: 'Home', odd: 2.1 },
            { value: 'Draw', odd: 3.4 },
            { value: 'Away', odd: 4.2 },
          ],
        },
      ],
    };
    // Cast to satisfy OddsBookmaker (values.odd already a number from Zod transform)
    expect(extractOneXTwoOdds([bk as never])).toBeNull();
  });

  it('returns null when Match Winner bet is absent for priority bookmaker', () => {
    const bk = {
      id: 4,
      name: 'Pinnacle',
      bets: [
        {
          id: 5,
          name: 'Goals Over/Under',
          values: [{ value: 'Over 2.5', odd: 1.57 }],
        },
      ],
    };
    expect(extractOneXTwoOdds([bk as never])).toBeNull();
  });

  it('returns null when Home/Draw/Away values are incomplete', () => {
    const bk = {
      id: 4,
      name: 'Pinnacle',
      bets: [
        {
          id: 1,
          name: 'Match Winner',
          // Missing Draw and Away
          values: [{ value: 'Home', odd: 2.1 }],
        },
      ],
    };
    expect(extractOneXTwoOdds([bk as never])).toBeNull();
  });
});
