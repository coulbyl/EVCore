import { describe, it, expect, vi } from 'vitest';
import type { BacktestService } from './backtest.service';
import type { GridSearchService } from './grid-search.service';
import type { ChannelBacktestService } from './channel-backtest.service';
import type { ModelCalibrationService } from './model-calibration.service';
import { BacktestController } from './backtest.controller';

describe('BacktestController', () => {
  function makeService(
    overrides: Partial<BacktestService> = {},
  ): BacktestService {
    return {
      runAllCompetitions: vi
        .fn()
        .mockResolvedValue([{ competitionCode: 'PL', overallVerdict: 'PASS' }]),
      runCompetitionBacktest: vi.fn().mockResolvedValue({
        competitionCode: 'PL',
        overallVerdict: 'PASS',
      }),
      runAllSeasonsSafeValueBacktest: vi
        .fn()
        .mockResolvedValue({ aggregate: { picksPlaced: 0 } }),
      ...overrides,
    } as unknown as BacktestService;
  }

  function makeGridSearchService(): GridSearchService {
    return {
      runGridSearch: vi.fn().mockResolvedValue({ results: [] }),
    } as unknown as GridSearchService;
  }

  function makeChannelBacktest(): ChannelBacktestService {
    return {
      run: vi.fn().mockResolvedValue({ reports: [] }),
    } as unknown as ChannelBacktestService;
  }

  function makeModelCalibration(): ModelCalibrationService {
    return {
      run: vi.fn().mockResolvedValue({ reports: [] }),
    } as unknown as ModelCalibrationService;
  }

  function makeController(service: BacktestService): BacktestController {
    return new BacktestController(
      service,
      makeGridSearchService(),
      makeChannelBacktest(),
      makeModelCalibration(),
    );
  }

  it('runs backtest for all competitions and returns reports', async () => {
    const service = makeService();
    const controller = makeController(service);

    await expect(controller.runAll()).resolves.toEqual([
      { competitionCode: 'PL', overallVerdict: 'PASS' },
    ]);
    expect(service.runAllCompetitions).toHaveBeenCalledTimes(1);
  });

  it('runs backtest for one competition (all seasons) and returns the report', async () => {
    const service = makeService();
    const controller = makeController(service);

    await expect(controller.runCompetition('PL')).resolves.toEqual({
      competitionCode: 'PL',
      overallVerdict: 'PASS',
    });
    expect(service.runCompetitionBacktest).toHaveBeenCalledWith('PL');
  });

  it('runs backtest for one competition + one season and returns the report', async () => {
    const service = makeService();
    const controller = makeController(service);

    await controller.runCompetitionSeason('PL', '2023-24');

    expect(service.runCompetitionBacktest).toHaveBeenCalledWith(
      'PL',
      '2023-24',
    );
  });

  it('delegates safe-value backtest to the service', async () => {
    const service = makeService();
    const controller = makeController(service);

    await controller.runSafeValueBacktest();

    expect(service.runAllSeasonsSafeValueBacktest).toHaveBeenCalledTimes(1);
  });
});
