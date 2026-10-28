import { describe, it, expect, vi } from 'vitest';
import { ActivityService } from './activity.service';
import type { ActivityRepository } from './activity.repository';

function makeService(fails = false) {
  const repository = {
    recordActiveDay: fails
      ? vi.fn().mockRejectedValue(new Error('db down'))
      : vi.fn().mockResolvedValue(undefined),
    recordEvent: vi.fn().mockResolvedValue(undefined),
  } as unknown as ActivityRepository;
  return { service: new ActivityService(repository), repository };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('ActivityService.touch', () => {
  it('writes one active day per player and per UTC day', async () => {
    const { service, repository } = makeService();
    const morning = new Date('2026-10-29T08:00:00Z');
    service.touch('u1', morning);
    service.touch('u1', new Date('2026-10-29T22:00:00Z'));
    service.touch('u1', new Date('2026-10-30T01:00:00Z'));
    await flush();
    expect(repository.recordActiveDay).toHaveBeenCalledTimes(2);
    expect(repository.recordActiveDay).toHaveBeenCalledWith(
      'u1',
      new Date('2026-10-29T00:00:00Z'),
    );
  });

  it('never throws on a failed write and retries on the next request', async () => {
    const { service, repository } = makeService(true);
    const at = new Date('2026-10-29T08:00:00Z');
    expect(() => service.touch('u1', at)).not.toThrow();
    await flush();
    service.touch('u1', at);
    await flush();
    expect(repository.recordActiveDay).toHaveBeenCalledTimes(2);
  });
});
