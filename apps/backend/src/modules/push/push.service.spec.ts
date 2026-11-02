import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import webpush from 'web-push';
import type { PushSubscription } from '@evcore/db';
import { PUSH_DELIVERY, PUSH_POLICY } from '@config/push.constants';
import {
  PushService,
  pushTopicOf,
  type PushDeliveryJobData,
} from './push.service';
import type { PushRepository } from './push.repository';

vi.mock('web-push', () => ({ default: { sendNotification: vi.fn() } }));

const VAPID = {
  VAPID_PUBLIC_KEY: 'pub',
  VAPID_PRIVATE_KEY: 'priv',
  VAPID_SUBJECT: 'mailto:team@example.com',
};

function sub(id: string): PushSubscription {
  return {
    id,
    userId: 'u1',
    endpoint: `https://push.example/${id}`,
    p256dh: 'p',
    auth: 'a',
    userAgent: null,
    createdAt: new Date(),
  };
}

function harness(env: Record<string, string> = VAPID) {
  const config = {
    get: (key: string) => env[key],
  } as unknown as ConfigService;
  const repo = {
    findByUserId: vi.fn().mockResolvedValue([sub('s1'), sub('s2')]),
    deleteByEndpoint: vi.fn().mockResolvedValue({ count: 1 }),
  } as unknown as PushRepository;
  const queue = {
    addBulk: vi.fn().mockResolvedValue([]),
  } as unknown as Queue<PushDeliveryJobData>;
  return { service: new PushService(config, repo, queue), repo, queue };
}

const payload = { title: 'Ta matinée', body: '…', url: '/today' };

// What web-push rejects with: an Error carrying the push service's status.
function refuseWith(error: { statusCode: number }): void {
  vi.mocked(webpush.sendNotification).mockImplementation(() =>
    Promise.reject(Object.assign(new Error('push refused'), error)),
  );
}

describe('PushService — through the delivery queue', () => {
  // Braces: a function returned by beforeEach is run as its teardown.
  beforeEach(() => {
    vi.mocked(webpush.sendNotification).mockReset();
  });

  it('queues one retried job per device, the caller waits on no push service', async () => {
    const { service, queue } = harness();
    await service.sendToUser('u1', payload);

    expect(queue.addBulk).toHaveBeenCalledTimes(1);
    const [jobs] = vi.mocked(queue.addBulk).mock.calls[0] ?? [];
    expect(jobs?.map((j) => j.data.subscriptionId)).toEqual(['s1', 's2']);
    expect(jobs?.[0]?.opts).toMatchObject({
      attempts: PUSH_DELIVERY.ATTEMPTS,
      backoff: { type: 'exponential', delay: PUSH_DELIVERY.BACKOFF_MS },
    });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it('queues nothing while push is not configured', async () => {
    const { service, queue } = harness({});
    await service.sendToUser('u1', payload);
    expect(queue.addBulk).not.toHaveBeenCalled();
  });

  it('deletes a gone subscription (410) and does not retry', async () => {
    const { service, repo } = harness();
    refuseWith({ statusCode: 410 });
    const vapid = await service.vapid();
    await expect(
      service.deliverOne({
        subscription: sub('s1'),
        payload,
        policy: PUSH_POLICY.DEFAULT,
        vapid: vapid!,
      }),
    ).resolves.toBe('gone');
    expect(repo.deleteByEndpoint).toHaveBeenCalledWith(
      'https://push.example/s1',
    );
  });

  it.each([429, 503])(
    'throws on %i so the queue tries again later',
    async (statusCode) => {
      const { service, repo } = harness();
      refuseWith({ statusCode });
      const vapid = await service.vapid();
      await expect(
        service.deliverOne({
          subscription: sub('s1'),
          payload,
          policy: PUSH_POLICY.DEFAULT,
          vapid: vapid!,
        }),
      ).rejects.toMatchObject({ statusCode });
      expect(repo.deleteByEndpoint).not.toHaveBeenCalled();
    },
  );

  it('sends with the TTL, the urgency and a topic that collapses the same tag', async () => {
    const { service } = harness();
    vi.mocked(webpush.sendNotification).mockResolvedValue({} as never);
    const vapid = await service.vapid();
    await service.deliverOne({
      subscription: sub('s1'),
      payload: { ...payload, tag: 'support-conv-1' },
      policy: PUSH_POLICY.MORNING_BRIEF,
      vapid: vapid!,
    });
    const [, body, options] =
      vi.mocked(webpush.sendNotification).mock.calls[0] ?? [];
    expect(JSON.parse(String(body))).toMatchObject({ tag: 'support-conv-1' });
    expect(options).toMatchObject({
      TTL: 4 * 3600,
      urgency: 'normal',
      topic: pushTopicOf('support-conv-1'),
    });
  });

  it('turns any tag into a valid Topic header', () => {
    const topic = pushTopicOf('followed-00000000-0000-4000-8000-000000000000');
    expect(topic).toMatch(/^[A-Za-z0-9_-]{1,32}$/);
    expect(pushTopicOf('followed-00000000-0000-4000-8000-000000000000')).toBe(
      topic,
    );
  });

  it('retries a network error, refuses a malformed subscription', async () => {
    const { service } = harness();
    const vapid = await service.vapid();
    const send = () =>
      service.deliverOne({
        subscription: sub('s1'),
        payload,
        policy: PUSH_POLICY.DEFAULT,
        vapid: vapid!,
      });
    vi.mocked(webpush.sendNotification).mockImplementation(() =>
      Promise.reject(
        Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }),
      ),
    );
    await expect(send()).rejects.toMatchObject({ code: 'ECONNRESET' });
    vi.mocked(webpush.sendNotification).mockImplementation(() =>
      Promise.reject(
        new Error('The subscription p256dh value should be 65 bytes long.'),
      ),
    );
    await expect(send()).resolves.toBe('refused');
  });

  it('logs another refusal (400) without retrying', async () => {
    const { service } = harness();
    refuseWith({ statusCode: 400 });
    const vapid = await service.vapid();
    await expect(
      service.deliverOne({
        subscription: sub('s1'),
        payload,
        policy: PUSH_POLICY.DEFAULT,
        vapid: vapid!,
      }),
    ).resolves.toBe('refused');
  });
});
