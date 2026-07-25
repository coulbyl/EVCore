import { describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';
import type { NotificationService } from '../../notification/notification.service';
import type { EtlService } from '../etl.service';
import {
  SeasonRolloverSyncWorker,
  type SeasonRolloverSyncJobData,
} from './season-rollover-sync.worker';

describe('SeasonRolloverSyncWorker', () => {
  it('delegates to EtlService.refreshLeagueSeasonSchedulers', async () => {
    const refreshLeagueSeasonSchedulers = vi
      .fn()
      .mockResolvedValue({ competitionsRefreshed: 3 });
    const etlService = {
      refreshLeagueSeasonSchedulers,
    } as unknown as EtlService;
    const notification = {
      sendEtlFailureAlert: vi.fn(),
    } as unknown as NotificationService;

    const worker = new SeasonRolloverSyncWorker(etlService);
    Object.assign(worker, { notification });

    await worker.process({ data: {} } as Job<SeasonRolloverSyncJobData>);

    expect(refreshLeagueSeasonSchedulers).toHaveBeenCalledOnce();
  });

  it('notifies on failure', () => {
    const etlService = {} as unknown as EtlService;
    const sendEtlFailureAlert = vi.fn();
    const notification = {
      sendEtlFailureAlert,
    } as unknown as NotificationService;

    const worker = new SeasonRolloverSyncWorker(etlService);
    Object.assign(worker, { notification });

    worker.onFailed(
      {
        data: {},
        name: 'season-rollover-sync',
        attemptsMade: 3,
        opts: { attempts: 3 },
      } as unknown as Job<SeasonRolloverSyncJobData>,
      new Error('boom'),
    );

    expect(sendEtlFailureAlert).toHaveBeenCalled();
  });
});
