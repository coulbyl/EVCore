import { describe, expect, it, vi } from 'vitest';
import { MlService } from './ml.service';
import type { MlRepository } from './ml.repository';
import type { NotificationService } from '@modules/notification/notification.service';
import type { MlInferenceService } from './ml.inference.service';
import type { Queue } from 'bullmq';

function makeService(overrides: {
  activeSegments: string[];
  health: { status: string; active_segments: string[] } | null;
}) {
  const repo = {
    findActiveSegments: vi.fn().mockResolvedValue(overrides.activeSegments),
  } as unknown as MlRepository;
  const notifications = {
    sendMlModelMissingAlert: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationService;
  const inference = {
    getHealth: vi.fn().mockResolvedValue(overrides.health),
  } as unknown as MlInferenceService;
  const queue = {} as Queue;

  const service = new MlService(repo, notifications, inference, queue);
  return { service, repo, notifications, inference };
}

describe('MlService.checkModelHealthAlignment', () => {
  it('alerts when a DB-active segment is not loaded by the ml-worker', async () => {
    const { service, notifications } = makeService({
      activeSegments: ['CONF:ONE_X_TWO', 'SAFE:BTTS'],
      health: { status: 'ok', active_segments: ['CONF:ONE_X_TWO'] },
    });

    const result = await service.checkModelHealthAlignment();

    expect(result.missing).toEqual(['SAFE:BTTS']);
    expect(notifications.sendMlModelMissingAlert).toHaveBeenCalledWith([
      'SAFE:BTTS',
    ]);
  });

  it('does not alert when every DB-active segment is loaded', async () => {
    const { service, notifications } = makeService({
      activeSegments: ['CONF:ONE_X_TWO'],
      health: { status: 'ok', active_segments: ['CONF:ONE_X_TWO', 'EXTRA'] },
    });

    const result = await service.checkModelHealthAlignment();

    expect(result.missing).toEqual([]);
    expect(notifications.sendMlModelMissingAlert).not.toHaveBeenCalled();
  });

  it('skips silently (no false alert) when the ml-worker is unreachable', async () => {
    const { service, notifications } = makeService({
      activeSegments: ['CONF:ONE_X_TWO'],
      health: null,
    });

    const result = await service.checkModelHealthAlignment();

    expect(result.missing).toEqual([]);
    expect(notifications.sendMlModelMissingAlert).not.toHaveBeenCalled();
  });
});
