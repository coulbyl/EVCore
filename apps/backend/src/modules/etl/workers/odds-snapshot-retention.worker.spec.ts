import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { ConfigService } from '@nestjs/config';
import type { FixtureService } from '@modules/fixture/fixture.service';
import type { NotificationService } from '@modules/notification/notification.service';
import { OddsSnapshotRetentionWorker } from './odds-snapshot-retention.worker';

describe('OddsSnapshotRetentionWorker', () => {
  const fixtureService = {
    deleteOddsSnapshotsOlderThan: vi.fn().mockResolvedValue(12),
  } satisfies Partial<FixtureService>;

  const config = {
    get: vi.fn().mockReturnValue('30'),
  } satisfies Partial<ConfigService>;

  const notification = {
    sendEtlFailureAlert: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<NotificationService>;

  const worker = new OddsSnapshotRetentionWorker(
    fixtureService as unknown as FixtureService,
    config as unknown as ConfigService,
    notification as unknown as NotificationService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    config.get.mockReturnValue('30');
  });

  it('deletes snapshots older than configured retention days', async () => {
    await worker.process({
      data: {},
    } as Job<{ retentionDays?: number }>);

    expect(fixtureService.deleteOddsSnapshotsOlderThan).toHaveBeenCalledTimes(
      1,
    );
    const [cutoff] = fixtureService.deleteOddsSnapshotsOlderThan.mock
      .calls[0] as [Date];
    expect(cutoff).toBeInstanceOf(Date);
  });

  it('allows job-level retention override', async () => {
    await worker.process({
      data: { retentionDays: 45 },
    } as Job<{ retentionDays?: number }>);

    expect(fixtureService.deleteOddsSnapshotsOlderThan).toHaveBeenCalledOnce();
  });

  it('throws on invalid retention days', async () => {
    config.get.mockReturnValue('0');

    await expect(
      worker.process({
        data: {},
      } as Job<{ retentionDays?: number }>),
    ).rejects.toThrow(
      'ODDS_SNAPSHOT_RETENTION_DAYS must be a positive integer',
    );
  });
});
