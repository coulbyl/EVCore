import { BadRequestException } from '@nestjs/common';
import { describe, it, expect, vi } from 'vitest';
import { EtlController } from './etl.controller';
import type { EtlService } from './etl.service';

describe('EtlController', () => {
  function makeService(overrides: Partial<EtlService> = {}): EtlService {
    return {
      triggerFullSync: vi.fn().mockResolvedValue(undefined),
      triggerFixturesSync: vi.fn().mockResolvedValue(undefined),
      triggerFixturesSyncForLeague: vi.fn().mockResolvedValue(undefined),
      triggerStatsSync: vi.fn().mockResolvedValue(undefined),
      triggerStatsSyncForLeague: vi.fn().mockResolvedValue(undefined),
      triggerStatsSyncForSeasons: vi.fn().mockResolvedValue(undefined),
      triggerInjuriesSync: vi.fn().mockResolvedValue(undefined),
      triggerInjuriesSyncForLeague: vi.fn().mockResolvedValue(undefined),
      triggerPendingBetsSettlementSync: vi.fn().mockResolvedValue(undefined),
      triggerStaleScheduledSync: vi.fn().mockResolvedValue(undefined),
      triggerOddsCsvImport: vi.fn().mockResolvedValue(undefined),
      triggerEloSync: vi.fn().mockResolvedValue(undefined),
      triggerOddsPrematchSync: vi.fn().mockResolvedValue(undefined),
      triggerOddsSnapshotRetention: vi.fn().mockResolvedValue(undefined),
      triggerBacktestAllSeasons: vi.fn().mockResolvedValue(undefined),
      triggerBacktestSeason: vi.fn().mockResolvedValue(undefined),
      triggerRollingStatsSeason: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    } as unknown as EtlService;
  }

  it('triggers full sync and returns ok', async () => {
    const service = makeService();
    const controller = new EtlController(service);

    await expect(controller.triggerFullSync()).resolves.toEqual({
      status: 'ok',
    });
    expect(service.triggerFullSync).toHaveBeenCalledTimes(1);
  });

  it('triggers stats sync and returns ok', async () => {
    const service = makeService();
    const controller = new EtlController(service);

    await expect(controller.triggerSync('stats')).resolves.toEqual({
      status: 'ok',
    });
    expect(service.triggerStatsSync).toHaveBeenCalledTimes(1);
  });

  it('triggers settlement sync and returns ok', async () => {
    const service = makeService();
    const controller = new EtlController(service);

    await expect(controller.triggerSync('settlement')).resolves.toEqual({
      status: 'ok',
    });
    expect(service.triggerPendingBetsSettlementSync).toHaveBeenCalledTimes(1);
  });

  it('triggers stale scheduled sync and returns ok', async () => {
    const service = makeService();
    const controller = new EtlController(service);

    await expect(controller.triggerSync('stale-scheduled')).resolves.toEqual({
      status: 'ok',
    });
    expect(service.triggerStaleScheduledSync).toHaveBeenCalledTimes(1);
  });

  it('triggers odds CSV import and returns ok', async () => {
    const service = makeService();
    const controller = new EtlController(service);

    await expect(controller.triggerSync('odds-csv')).resolves.toEqual({
      status: 'ok',
    });
    expect(service.triggerOddsCsvImport).toHaveBeenCalledTimes(1);
  });

  it('triggers odds prematch sync and returns ok', async () => {
    const service = makeService();
    const controller = new EtlController(service);

    await expect(
      controller.triggerSync('odds-prematch', { date: '2026-03-10' }),
    ).resolves.toEqual({
      status: 'ok',
    });
    expect(service.triggerOddsPrematchSync).toHaveBeenCalledWith('2026-03-10');
  });

  it('triggers Elo sync and returns ok', async () => {
    const service = makeService();
    const controller = new EtlController(service);

    await expect(controller.triggerSync('elo')).resolves.toEqual({
      status: 'ok',
    });
    expect(service.triggerEloSync).toHaveBeenCalledTimes(1);
  });

  it('triggers odds snapshot retention and returns ok', async () => {
    const service = makeService();
    const controller = new EtlController(service);

    await expect(
      controller.triggerSync('odds-retention', { retentionDays: 45 }),
    ).resolves.toEqual({
      status: 'ok',
    });
    expect(service.triggerOddsSnapshotRetention).toHaveBeenCalledWith(45);
  });

  it('triggers league-scoped sync and returns competitionCode', async () => {
    const service = makeService();
    const controller = new EtlController(service);

    await expect(
      controller.triggerSyncForCompetition('fixtures', 'pl'),
    ).resolves.toEqual({
      status: 'ok',
      competitionCode: 'PL',
    });
    expect(service.triggerFixturesSyncForLeague).toHaveBeenCalledWith('PL');
  });

  it('rejects unsupported league-scoped sync types', async () => {
    const controller = new EtlController(makeService());

    await expect(
      controller.triggerSyncForCompetition('settlement', 'PL'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('triggers rolling-stats refresh via ETL and normalizes the competition code', async () => {
    const service = makeService();
    const controller = new EtlController(service);

    await expect(
      controller.triggerRollingStatsSeason('pl', '2024'),
    ).resolves.toEqual({
      status: 'ok',
      competitionCode: 'PL',
      season: 2024,
      mode: 'refresh',
    });
    expect(service.triggerRollingStatsSeason).toHaveBeenCalledWith(
      'PL',
      2024,
      'refresh',
    );
  });

  it('triggers rolling-stats rebuild via ETL', async () => {
    const service = makeService();
    const controller = new EtlController(service);

    await expect(
      controller.triggerRollingStatsSeason('pl', '2024', { mode: 'rebuild' }),
    ).resolves.toEqual({
      status: 'ok',
      competitionCode: 'PL',
      season: 2024,
      mode: 'rebuild',
    });
    expect(service.triggerRollingStatsSeason).toHaveBeenCalledWith(
      'PL',
      2024,
      'rebuild',
    );
  });

  it('triggers historical stats backfill via ETL', async () => {
    const service = makeService();
    const controller = new EtlController(service);

    await expect(
      controller.triggerStatsBackfill('j1', '2023,2024,2025'),
    ).resolves.toEqual({
      status: 'ok',
      competitionCode: 'J1',
      seasons: [2023, 2024, 2025],
    });
    expect(service.triggerStatsSyncForSeasons).toHaveBeenCalledWith('J1', [
      2023,
      2024,
      2025,
    ]);
  });

  it('rejects invalid rolling-stats mode', async () => {
    const controller = new EtlController(makeService());

    await expect(
      controller.triggerRollingStatsSeason('PL', '2024', {
        mode: 'invalid' as 'refresh',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('triggers all-seasons backtest via ETL', async () => {
    const service = makeService();
    const controller = new EtlController(service);

    await expect(controller.triggerBacktest()).resolves.toEqual({
      status: 'ok',
    });
    expect(service.triggerBacktestAllSeasons).toHaveBeenCalledTimes(1);
  });

  it('triggers one-season backtest via ETL', async () => {
    const service = makeService();
    const controller = new EtlController(service);

    await expect(controller.triggerBacktestSeason('season-1')).resolves.toEqual(
      {
        status: 'ok',
        seasonId: 'season-1',
      },
    );
    expect(service.triggerBacktestSeason).toHaveBeenCalledWith('season-1');
  });
});
