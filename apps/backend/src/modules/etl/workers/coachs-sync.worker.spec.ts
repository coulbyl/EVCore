import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachSyncWorker } from './coachs-sync.worker';
import type { PrismaService } from '@/prisma.service';
import type { ApiFootballClient } from '../api-football.client';
import type { NotificationService } from '@modules/notification/notification.service';

beforeEach(() => {
  // Skip the 6s rate-limit sleep between teams so tests don't time out.
  vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn) => {
    if (typeof fn === 'function') fn();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  });
});

function makeApiFootballMock(
  responsesByExternalId: Record<number, unknown>,
): ApiFootballClient {
  return {
    fetchJson: vi.fn((url: string) => {
      const match = /team=(\d+)/.exec(url);
      const externalId = match ? Number(match[1]) : -1;
      const body = responsesByExternalId[externalId];
      return Promise.resolve({
        response: body === undefined ? null : { status: 200, body },
      });
    }),
  } as unknown as ApiFootballClient;
}

function makeNotificationMock(): NotificationService {
  return {
    sendEtlFailureAlert: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationService;
}

describe('CoachSyncWorker', () => {
  it('upserts a tenure for each career leg whose team is tracked, skipping untracked teams', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const prisma = {
      client: {
        team: {
          findMany: vi
            .fn()
            .mockResolvedValue([{ id: 'real-madrid-id', externalId: 541 }]),
        },
        coachTenure: { upsert },
      },
    } as unknown as PrismaService;

    const apiFootball = makeApiFootballMock({
      541: {
        get: 'coachs',
        parameters: { team: '541' },
        results: 1,
        response: [
          {
            id: 1584,
            name: 'Z. Zidane',
            career: [
              {
                team: { id: 541, name: 'Real Madrid' },
                start: '2019-03-01',
                end: '2021-05-01',
              },
              {
                // Untracked team (not in our DB) — must be skipped, no FK to store under.
                team: { id: 9575, name: 'Real Madrid II' },
                start: '2015-07-01',
                end: '2016-01-01',
              },
            ],
          },
        ],
      },
    });

    const worker = new CoachSyncWorker(
      prisma,
      apiFootball,
      makeNotificationMock(),
    );

    await worker.process({ data: {} } as never);

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          teamId_coachName_startDate: {
            teamId: 'real-madrid-id',
            coachName: 'Z. Zidane',
            startDate: new Date('2019-03-01'),
          },
        },
        create: {
          teamId: 'real-madrid-id',
          coachName: 'Z. Zidane',
          startDate: new Date('2019-03-01'),
          endDate: new Date('2021-05-01'),
        },
        update: { endDate: new Date('2021-05-01') },
      }),
    );
  });

  it('stores a null endDate for a coach still in charge', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const prisma = {
      client: {
        team: {
          findMany: vi
            .fn()
            .mockResolvedValue([{ id: 'real-madrid-id', externalId: 541 }]),
        },
        coachTenure: { upsert },
      },
    } as unknown as PrismaService;

    const apiFootball = makeApiFootballMock({
      541: {
        get: 'coachs',
        parameters: { team: '541' },
        results: 1,
        response: [
          {
            id: 6801,
            name: 'Xabi Alonso',
            career: [
              {
                team: { id: 541, name: 'Real Madrid' },
                start: '2025-06-01',
                end: null,
              },
            ],
          },
        ],
      },
    });

    const worker = new CoachSyncWorker(
      prisma,
      apiFootball,
      makeNotificationMock(),
    );

    await worker.process({ data: {} } as never);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ endDate: null }),
        update: { endDate: null },
      }),
    );
  });

  it('skips a team on a transient fetch failure without throwing', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const prisma = {
      client: {
        team: {
          findMany: vi
            .fn()
            .mockResolvedValue([{ id: 'team-id', externalId: 999 }]),
        },
        coachTenure: { upsert },
      },
    } as unknown as PrismaService;

    const apiFootball = {
      fetchJson: vi.fn().mockResolvedValue({ response: null }),
    } as unknown as ApiFootballClient;

    const worker = new CoachSyncWorker(
      prisma,
      apiFootball,
      makeNotificationMock(),
    );

    await expect(
      worker.process({ data: {} } as never),
    ).resolves.toBeUndefined();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('skips a coach with no career legs referencing a tracked team', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const prisma = {
      client: {
        team: {
          findMany: vi
            .fn()
            .mockResolvedValue([{ id: 'real-madrid-id', externalId: 541 }]),
        },
        coachTenure: { upsert },
      },
    } as unknown as PrismaService;

    const apiFootball = makeApiFootballMock({
      541: {
        get: 'coachs',
        parameters: { team: '541' },
        results: 1,
        response: [
          {
            id: 1,
            name: null, // unnamed coach entry — skipped
            career: [
              {
                team: { id: 541, name: 'Real Madrid' },
                start: '2019-03-01',
                end: '2021-05-01',
              },
            ],
          },
        ],
      },
    });

    const worker = new CoachSyncWorker(
      prisma,
      apiFootball,
      makeNotificationMock(),
    );

    await worker.process({ data: {} } as never);

    expect(upsert).not.toHaveBeenCalled();
  });
});
