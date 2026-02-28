import { describe, it, expect, vi } from 'vitest';
import { EtlController } from './etl.controller';
import type { EtlService } from './etl.service';

describe('EtlController', () => {
  function makeService(overrides: Partial<EtlService> = {}): EtlService {
    return {
      triggerFullSync: vi.fn().mockResolvedValue(undefined),
      triggerStatsSync: vi.fn().mockResolvedValue(undefined),
      triggerOddsCsvImport: vi.fn().mockResolvedValue(undefined),
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

    await expect(controller.triggerStatsSync()).resolves.toEqual({
      status: 'ok',
    });
    expect(service.triggerStatsSync).toHaveBeenCalledTimes(1);
  });

  it('triggers odds CSV import and returns ok', async () => {
    const service = makeService();
    const controller = new EtlController(service);

    await expect(controller.triggerOddsCsvImport()).resolves.toEqual({
      status: 'ok',
    });
    expect(service.triggerOddsCsvImport).toHaveBeenCalledTimes(1);
  });
});
