import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { EtlController } from './etl.controller';
import type { EtlService } from './etl.service';

describe('EtlController', () => {
  it('triggers full sync and returns ok', async () => {
    const triggerFullSync = vi.fn().mockResolvedValue(undefined);
    const triggerOddsHistoricalSync = vi.fn().mockResolvedValue(undefined);
    const triggerOddsHistoricalSyncForSeason = vi
      .fn()
      .mockResolvedValue(undefined);

    const serviceMock = {
      triggerFullSync,
      triggerOddsHistoricalSync,
      triggerOddsHistoricalSyncForSeason,
    } as unknown as EtlService;

    const controller = new EtlController(serviceMock);

    await expect(controller.triggerFullSync()).resolves.toEqual({
      status: 'ok',
    });
    expect(triggerFullSync).toHaveBeenCalledTimes(1);
  });

  it('triggers odds historical sync and returns ok', async () => {
    const triggerFullSync = vi.fn().mockResolvedValue(undefined);
    const triggerOddsHistoricalSync = vi.fn().mockResolvedValue(undefined);
    const triggerOddsHistoricalSyncForSeason = vi
      .fn()
      .mockResolvedValue(undefined);

    const serviceMock = {
      triggerFullSync,
      triggerOddsHistoricalSync,
      triggerOddsHistoricalSyncForSeason,
    } as unknown as EtlService;

    const controller = new EtlController(serviceMock);

    await expect(controller.triggerOddsHistoricalSync()).resolves.toEqual({
      status: 'ok',
    });
    expect(triggerOddsHistoricalSync).toHaveBeenCalledTimes(1);
  });

  it('triggers odds historical sync for a single season', async () => {
    const triggerFullSync = vi.fn().mockResolvedValue(undefined);
    const triggerOddsHistoricalSync = vi.fn().mockResolvedValue(undefined);
    const triggerOddsHistoricalSyncForSeason = vi
      .fn()
      .mockResolvedValue(undefined);

    const serviceMock = {
      triggerFullSync,
      triggerOddsHistoricalSync,
      triggerOddsHistoricalSyncForSeason,
    } as unknown as EtlService;

    const controller = new EtlController(serviceMock);

    await expect(
      controller.triggerOddsHistoricalSyncForSeason('2023'),
    ).resolves.toEqual({
      status: 'ok',
      season: 2023,
    });
    expect(triggerOddsHistoricalSyncForSeason).toHaveBeenCalledWith(2023);
  });

  it('throws on invalid season format', async () => {
    const triggerFullSync = vi.fn().mockResolvedValue(undefined);
    const triggerOddsHistoricalSync = vi.fn().mockResolvedValue(undefined);
    const triggerOddsHistoricalSyncForSeason = vi
      .fn()
      .mockResolvedValue(undefined);

    const serviceMock = {
      triggerFullSync,
      triggerOddsHistoricalSync,
      triggerOddsHistoricalSyncForSeason,
    } as unknown as EtlService;

    const controller = new EtlController(serviceMock);

    await expect(
      controller.triggerOddsHistoricalSyncForSeason('bad'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
