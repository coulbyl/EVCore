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
      triggerInjuriesSync: vi.fn().mockResolvedValue(undefined),
      triggerInjuriesSyncForLeague: vi.fn().mockResolvedValue(undefined),
      triggerPendingBetsSettlementSync: vi.fn().mockResolvedValue(undefined),
      triggerOddsCsvImport: vi.fn().mockResolvedValue(undefined),
      triggerOddsLiveSync: vi.fn().mockResolvedValue(undefined),
      triggerOddsSnapshotRetention: vi.fn().mockResolvedValue(undefined),
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

  it('triggers odds CSV import and returns ok', async () => {
    const service = makeService();
    const controller = new EtlController(service);

    await expect(controller.triggerSync('odds-csv')).resolves.toEqual({
      status: 'ok',
    });
    expect(service.triggerOddsCsvImport).toHaveBeenCalledTimes(1);
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
});
