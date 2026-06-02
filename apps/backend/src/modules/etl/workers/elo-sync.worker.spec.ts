import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { execFile } from 'node:child_process';
import {
  EloSyncWorker,
  downloadWorldEloTsvViaCurl,
  parseWorldEloTsv,
} from './elo-sync.worker';
import type { PrismaService } from '@/prisma.service';
import type { NotificationService } from '@modules/notification/notification.service';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

describe('parseWorldEloTsv', () => {
  it('maps TSV ratings onto internal team names', () => {
    const rows = parseWorldEloTsv(
      ['1\t1\tDE\t1922', '2\t2\tGH\t1725', '3\t3\tAM\t1379'].join('\n'),
    );

    expect(rows).toEqual(
      expect.arrayContaining([
        { teamName: 'Germany', eloCode: 'DE', rating: 1922 },
        { teamName: 'Ghana', eloCode: 'GH', rating: 1725 },
        { teamName: 'Armenia', eloCode: 'AM', rating: 1379 },
      ]),
    );
  });

  it('maps newly added FRI aliases onto TSV codes', () => {
    const rows = parseWorldEloTsv(
      [
        '1\t1\tHR\t1930',
        '2\t2\tTN\t1633',
        '3\t3\tCD\t1655',
        '4\t4\tIE\t1694',
        '5\t5\tCZ\t1733',
        '6\t6\tWA\t1698',
        '7\t7\tPH\t1167',
      ].join('\n'),
    );

    expect(rows).toEqual(
      expect.arrayContaining([
        { teamName: 'Croatia', eloCode: 'HR', rating: 1930 },
        { teamName: 'Tunisia', eloCode: 'TN', rating: 1633 },
        { teamName: 'DR Congo', eloCode: 'CD', rating: 1655 },
        { teamName: 'Congo DR', eloCode: 'CD', rating: 1655 },
        { teamName: 'Ireland', eloCode: 'IE', rating: 1694 },
        { teamName: 'Rep. Of Ireland', eloCode: 'IE', rating: 1694 },
        { teamName: 'Czech Republic', eloCode: 'CZ', rating: 1733 },
        { teamName: 'Wales', eloCode: 'WA', rating: 1698 },
        { teamName: 'Philippines', eloCode: 'PH', rating: 1167 },
      ]),
    );
  });
});

describe('EloSyncWorker', () => {
  const createMany = vi.fn().mockResolvedValue({ count: 2 });
  const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
  // eslint-disable-next-line @typescript-eslint/require-await
  const transaction = vi.fn().mockImplementation(async (ops: unknown[]) => ops);
  const prisma = {
    client: {
      nationalTeamEloRating: {
        createMany,
        deleteMany,
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: transaction,
    },
  } as unknown as PrismaService;
  const notification = {
    sendEtlFailureAlert: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationService;
  const worker = new EloSyncWorker(prisma, notification);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('downloads and persists a fresh snapshot', async () => {
    vi.mocked(execFile).mockImplementation((...args) => {
      const callback = args.at(-1);
      if (typeof callback === 'function') {
        callback(null, '1\t1\tDE\t1922\n2\t2\tGH\t1725\n', '');
      }
      return {} as never;
    });

    await worker.process({} as never);

    expect(createMany).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            teamName: 'Germany',
            eloCode: 'DE',
            rating: 1922,
            source: 'eloratings.net',
          }),
          expect.objectContaining({
            teamName: 'Ghana',
            eloCode: 'GH',
            rating: 1725,
            source: 'eloratings.net',
          }),
        ]),
      }),
    );
    expect(deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          snapshotAt: { lt: expect.any(Date) },
        },
      }),
    );
  });

  it('falls back to curl when fetch cannot download the TSV', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('fetch failed')),
    );
    vi.mocked(execFile).mockImplementation((...args) => {
      const callback = args.at(-1);
      if (typeof callback === 'function') {
        callback(null, '1\t1\tDE\t1922\n2\t2\tGH\t1725\n', '');
      }
      return {} as never;
    });

    await worker.process({} as never);

    expect(createMany).toHaveBeenCalledTimes(1);
  });
});

describe('downloadWorldEloTsvViaCurl', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when curl fails', async () => {
    vi.mocked(execFile).mockImplementation((...args) => {
      const callback = args.at(-1);
      if (typeof callback === 'function') {
        callback(new Error('curl failed'), '', '');
      }
      return {} as never;
    });

    await expect(downloadWorldEloTsvViaCurl()).resolves.toBeNull();
  });
});
