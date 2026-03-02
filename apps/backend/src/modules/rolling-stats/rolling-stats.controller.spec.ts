import { BadRequestException } from '@nestjs/common';
import { describe, it, expect, vi } from 'vitest';
import type { RollingStatsService } from './rolling-stats.service';
import { RollingStatsController } from './rolling-stats.controller';

describe('RollingStatsController', () => {
  function makeService(
    overrides: Partial<RollingStatsService> = {},
  ): RollingStatsService {
    return {
      backfillSeasonYear: vi.fn().mockResolvedValue({
        seasonId: 'season-id',
        fixtureCount: 380,
        upsertCount: 760,
      }),
      backfillAllConfiguredSeasons: vi.fn().mockResolvedValue([]),
      ...overrides,
    } as unknown as RollingStatsService;
  }

  it('triggers backfill for a specific competition/season and normalizes code to uppercase', async () => {
    const service = makeService();
    const controller = new RollingStatsController(service);

    await expect(controller.backfillSeason('pl', '2024')).resolves.toEqual({
      status: 'ok',
      seasonId: 'season-id',
      fixtureCount: 380,
      upsertCount: 760,
    });
    expect(service.backfillSeasonYear).toHaveBeenCalledWith(2024, 'PL');
  });

  it('rejects unknown competition code', async () => {
    const service = makeService();
    const controller = new RollingStatsController(service);

    await expect(
      controller.backfillSeason('unknown', '2024'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.backfillSeasonYear).not.toHaveBeenCalled();
  });

  it('rejects invalid season year', async () => {
    const service = makeService();
    const controller = new RollingStatsController(service);

    await expect(controller.backfillSeason('PL', 'abc')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(service.backfillSeasonYear).not.toHaveBeenCalled();
  });

  it('triggers backfill-all and returns ok payload', async () => {
    const seasons = [{ competitionCode: 'PL', year: 2024 }];
    const service = makeService({
      backfillAllConfiguredSeasons: vi.fn().mockResolvedValue(seasons),
    });
    const controller = new RollingStatsController(service);

    await expect(controller.backfillAll()).resolves.toEqual({
      status: 'ok',
      seasons,
    });
    expect(service.backfillAllConfiguredSeasons).toHaveBeenCalledTimes(1);
  });
});
