import { describe, it, expect, vi } from 'vitest';
import type { ChannelBacktestService } from './channel-backtest.service';
import type { ModelCalibrationService } from './model-calibration.service';
import type { ChannelTuningService } from './channel-tuning.service';
import { BacktestController } from './backtest.controller';

describe('BacktestController', () => {
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

  function makeChannelTuning(): ChannelTuningService {
    return {
      run: vi.fn().mockResolvedValue({ reports: [] }),
    } as unknown as ChannelTuningService;
  }

  function makeController(overrides?: {
    channelBacktest?: ChannelBacktestService;
    modelCalibration?: ModelCalibrationService;
    channelTuning?: ChannelTuningService;
  }): BacktestController {
    return new BacktestController(
      overrides?.channelBacktest ?? makeChannelBacktest(),
      overrides?.modelCalibration ?? makeModelCalibration(),
      overrides?.channelTuning ?? makeChannelTuning(),
    );
  }

  it('delegates the per-channel backtest with its query window', async () => {
    const channelBacktest = makeChannelBacktest();
    const controller = makeController({ channelBacktest });

    await controller.runChannels('2025-01-01', '2025-06-01', 'PL');

    expect(channelBacktest.run).toHaveBeenCalledWith({
      from: '2025-01-01',
      to: '2025-06-01',
      competitionCode: 'PL',
    });
  });

  it('delegates threshold tuning with its query window', async () => {
    const channelTuning = makeChannelTuning();
    const controller = makeController({ channelTuning });

    await controller.runTuning('2025-01-01', '2025-06-01', 'BL1');

    expect(channelTuning.run).toHaveBeenCalledWith({
      from: '2025-01-01',
      to: '2025-06-01',
      competitionCode: 'BL1',
    });
  });

  it('delegates model calibration with its query window', async () => {
    const modelCalibration = makeModelCalibration();
    const controller = makeController({ modelCalibration });

    await controller.runCalibration(undefined, undefined, undefined);

    expect(modelCalibration.run).toHaveBeenCalledWith({
      from: undefined,
      to: undefined,
      competitionCode: undefined,
    });
  });
});
