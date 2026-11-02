import { Injectable } from '@nestjs/common';
import type { Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

const BASE_SELECT = {
  id: true,
  title: true,
  description: true,
  href: true,
  published: true,
  publishedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, username: true, fullName: true } },
} as const;

export type AnnouncementRecord = Prisma.AnnouncementGetPayload<{
  select: typeof BASE_SELECT;
}>;

/** Every query on announcements and their reads (CLAUDE.md: Prisma here only). */
@Injectable()
export class AnnouncementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Published and not expired, newest first; with one player's read state. */
  listLive(input: {
    now: Date;
    userId?: string;
  }): Promise<(AnnouncementRecord & { reads?: { readAt: Date }[] })[]> {
    return this.prisma.client.announcement.findMany({
      where: {
        published: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: input.now } }],
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        ...BASE_SELECT,
        ...(input.userId && {
          reads: {
            where: { userId: input.userId },
            select: { readAt: true },
          },
        }),
      },
    });
  }

  /** Every announcement for the team, with how many players read it. */
  listAll(): Promise<(AnnouncementRecord & { _count: { reads: number } })[]> {
    return this.prisma.client.announcement.findMany({
      orderBy: [{ updatedAt: 'desc' }],
      select: { ...BASE_SELECT, _count: { select: { reads: true } } },
    });
  }

  findState(
    id: string,
  ): Promise<{ id: string; title: string; published: boolean } | null> {
    return this.prisma.client.announcement.findUnique({
      where: { id },
      select: { id: true, title: true, published: true },
    });
  }

  async markRead(input: {
    userId: string;
    announcementId: string;
  }): Promise<void> {
    await this.prisma.client.announcementRead.upsert({
      where: { userId_announcementId: input },
      create: input,
      update: {},
    });
  }

  create(
    data: Prisma.AnnouncementUncheckedCreateInput,
  ): Promise<AnnouncementRecord> {
    return this.prisma.client.announcement.create({
      data,
      select: BASE_SELECT,
    });
  }

  update(input: {
    id: string;
    data: Prisma.AnnouncementUncheckedUpdateInput;
  }): Promise<AnnouncementRecord> {
    return this.prisma.client.announcement.update({
      where: { id: input.id },
      data: input.data,
      select: BASE_SELECT,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.client.announcement.delete({ where: { id } });
  }
}
