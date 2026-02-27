import { describe, it, expect, vi } from 'vitest';
import { EtlController } from './etl.controller';
import type { EtlService } from './etl.service';

describe('EtlController', () => {
  it('triggers full sync and returns ok', async () => {
    const serviceMock = {
      triggerFullSync: vi.fn().mockResolvedValue(undefined),
      triggerOddsHistoricalSync: vi.fn().mockResolvedValue(undefined),
    } as unknown as EtlService;

    const controller = new EtlController(serviceMock);

    await expect(controller.triggerFullSync()).resolves.toEqual({
      status: 'ok',
    });
    expect(serviceMock.triggerFullSync).toHaveBeenCalledTimes(1);
  });

  it('triggers odds historical sync and returns ok', async () => {
    const serviceMock = {
      triggerFullSync: vi.fn().mockResolvedValue(undefined),
      triggerOddsHistoricalSync: vi.fn().mockResolvedValue(undefined),
    } as unknown as EtlService;

    const controller = new EtlController(serviceMock);

    await expect(controller.triggerOddsHistoricalSync()).resolves.toEqual({
      status: 'ok',
    });
    expect(serviceMock.triggerOddsHistoricalSync).toHaveBeenCalledTimes(1);
  });
});
