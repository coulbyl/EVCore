import { NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi } from 'vitest';
import type { BacktestService } from './backtest.service';
import { BacktestController } from './backtest.controller';

describe('BacktestController', () => {
  function makeService(
    overrides: Partial<BacktestService> = {},
  ): BacktestService {
    return {
      getLatestValidationReport: vi.fn().mockReturnValue({
        totalAnalyzed: 100,
        overallVerdict: 'PASS',
      }),
      ...overrides,
    } as unknown as BacktestService;
  }

  it('returns the cached validation report', () => {
    const service = makeService();
    const controller = new BacktestController(service);

    expect(controller.getValidationReport()).toEqual({
      totalAnalyzed: 100,
      overallVerdict: 'PASS',
    });
    expect(service.getLatestValidationReport).toHaveBeenCalledTimes(1);
  });

  it('rejects when no cached validation report exists yet', () => {
    const service = makeService({
      getLatestValidationReport: vi.fn().mockReturnValue(null),
    });
    const controller = new BacktestController(service);

    expect(() => controller.getValidationReport()).toThrow(NotFoundException);
  });
});
