import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaService } from '@/prisma.service';
import { FormationContentType } from '@evcore/db';
import { FormationProgressRepository } from './formation-progress.repository';

describe('FormationProgressRepository', () => {
  const findMany = vi.fn().mockResolvedValue([]);
  const upsert = vi.fn().mockResolvedValue({
    contentType: FormationContentType.ARTICLE,
    slug: 'intro',
    completedAt: new Date('2026-05-01T00:00:00.000Z'),
  });
  const deleteFn = vi.fn().mockResolvedValue({ id: 'id' });

  const prisma = {
    client: {
      userContentProgress: {
        findMany,
        upsert,
        delete: deleteFn,
      },
    },
  } as unknown as PrismaService;

  const repo = new FormationProgressRepository(prisma);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists progress ordered by completedAt desc', async () => {
    await repo.list('user-id');

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'user-id' },
      select: { contentType: true, slug: true, completedAt: true },
      orderBy: { completedAt: 'desc' },
    });
  });

  it('upserts progress by composite key', async () => {
    await repo.upsert({
      userId: 'user-id',
      contentType: FormationContentType.VIDEO,
      slug: 'intro-video',
    });

    expect(upsert).toHaveBeenCalledWith({
      where: {
        userId_contentType_slug: {
          userId: 'user-id',
          contentType: FormationContentType.VIDEO,
          slug: 'intro-video',
        },
      },
      create: {
        userId: 'user-id',
        contentType: FormationContentType.VIDEO,
        slug: 'intro-video',
        completedAt: expect.any(Date),
      },
      update: { completedAt: expect.any(Date) },
      select: { contentType: true, slug: true, completedAt: true },
    });
  });

  it('deletes progress by composite key', async () => {
    await repo.remove({
      userId: 'user-id',
      contentType: FormationContentType.ARTICLE,
      slug: 'intro',
    });

    expect(deleteFn).toHaveBeenCalledWith({
      where: {
        userId_contentType_slug: {
          userId: 'user-id',
          contentType: FormationContentType.ARTICLE,
          slug: 'intro',
        },
      },
    });
  });
});
