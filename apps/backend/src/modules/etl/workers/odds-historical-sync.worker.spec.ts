import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';
import { OddsHistoricalSyncWorker } from './odds-historical-sync.worker';
import type { FixtureService } from '@modules/fixture/fixture.service';
import type { ConfigService } from '@nestjs/config';

describe('OddsHistoricalSyncWorker', () => {
  const fixtureServiceMock = {
    findByExternalId: vi.fn(),
    upsertOneXTwoOddsSnapshot: vi.fn(),
  } as unknown as FixtureService;

  const configMock = {
    getOrThrow: vi.fn(),
    get: vi.fn(),
  } as unknown as ConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    (
      configMock.getOrThrow as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue('odds-api-key');
    (configMock.get as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      '39',
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores one-x-two snapshots for matched fixtures', async () => {
    const worker = new OddsHistoricalSyncWorker(fixtureServiceMock, configMock);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            response: [
              {
                fixture: { id: 1234, date: '2023-01-01T15:00:00Z' },
                update: 1_672_584_000,
                bookmakers: [
                  {
                    name: 'BookieA',
                    bets: [
                      {
                        name: 'Match Winner',
                        values: [
                          { value: 'Home', odd: '2.10' },
                          { value: 'Draw', odd: '3.40' },
                          { value: 'Away', odd: '4.20' },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          }),
      }),
    );

    (
      fixtureServiceMock.findByExternalId as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'fixture-id-1',
    });
    (
      fixtureServiceMock.upsertOneXTwoOddsSnapshot as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ id: 'snapshot-id-1' });

    await worker.process({ data: { season: 2023 } } as Job<{ season: number }>);

    expect(fixtureServiceMock.findByExternalId).toHaveBeenCalledWith(1234);
    expect(fixtureServiceMock.upsertOneXTwoOddsSnapshot).toHaveBeenCalledTimes(
      1,
    );
    expect(fixtureServiceMock.upsertOneXTwoOddsSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        fixtureId: 'fixture-id-1',
        bookmaker: 'BookieA',
        homeOdds: 2.1,
        drawOdds: 3.4,
        awayOdds: 4.2,
      }),
    );
  });

  it('skips entries when fixture does not exist in DB', async () => {
    const worker = new OddsHistoricalSyncWorker(fixtureServiceMock, configMock);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            response: [
              {
                fixture: { id: 9999, date: '2023-01-01T15:00:00Z' },
                bookmakers: [],
              },
            ],
          }),
      }),
    );

    (
      fixtureServiceMock.findByExternalId as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    await worker.process({ data: { season: 2023 } } as Job<{ season: number }>);

    expect(fixtureServiceMock.findByExternalId).toHaveBeenCalledWith(9999);
    expect(fixtureServiceMock.upsertOneXTwoOddsSnapshot).not.toHaveBeenCalled();
  });
});
