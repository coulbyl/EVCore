import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import type { CreateAnnouncementDto } from './dto/create-announcement.dto';
import type { UpdateAnnouncementDto } from './dto/update-announcement.dto';

export type AnnouncementView = {
  id: string;
  title: string;
  description: string | null;
  href: string;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    username: string;
    fullName: string;
  } | null;
};

type AnnouncementRecord = {
  id: string;
  title: string;
  description: string | null;
  href: string;
  published: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    username: string;
    fullName: string;
  } | null;
};

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  private toView(announcement: AnnouncementRecord): AnnouncementView {
    return {
      id: announcement.id,
      title: announcement.title,
      description: announcement.description,
      href: announcement.href,
      published: announcement.published,
      publishedAt: announcement.publishedAt?.toISOString() ?? null,
      createdAt: announcement.createdAt.toISOString(),
      updatedAt: announcement.updatedAt.toISOString(),
      createdBy: announcement.createdBy
        ? {
            id: announcement.createdBy.id,
            username: announcement.createdBy.username,
            fullName: announcement.createdBy.fullName,
          }
        : null,
    };
  }

  private readonly baseSelect = {
    id: true,
    title: true,
    description: true,
    href: true,
    published: true,
    publishedAt: true,
    createdAt: true,
    updatedAt: true,
    createdBy: {
      select: {
        id: true,
        username: true,
        fullName: true,
      },
    },
  } as const;

  async listPublished(): Promise<AnnouncementView[]> {
    const items = await this.prisma.client.announcement.findMany({
      where: { published: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: this.baseSelect,
    });

    return items.map((item) => this.toView(item));
  }

  async listAdmin(): Promise<AnnouncementView[]> {
    const items = await this.prisma.client.announcement.findMany({
      orderBy: [{ published: 'desc' }, { updatedAt: 'desc' }],
      select: this.baseSelect,
    });

    return items.map((item) => this.toView(item));
  }

  async create(
    userId: string,
    dto: CreateAnnouncementDto,
  ): Promise<AnnouncementView> {
    const created = await this.prisma.client.announcement.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        href: dto.href.trim(),
        published: dto.published ?? false,
        publishedAt: dto.published ? new Date() : null,
        createdById: userId,
      },
      select: this.baseSelect,
    });

    return this.toView(created);
  }

  async update(
    id: string,
    dto: UpdateAnnouncementDto,
  ): Promise<AnnouncementView> {
    const existing = await this.prisma.client.announcement.findUnique({
      where: { id },
      select: {
        id: true,
        published: true,
      },
    });
    if (!existing) throw new NotFoundException('Announcement not found');

    const nextPublished =
      dto.published !== undefined ? dto.published : existing.published;

    const updated = await this.prisma.client.announcement.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description:
          dto.description !== undefined
            ? dto.description.trim() || null
            : undefined,
        href: dto.href?.trim(),
        published: dto.published,
        publishedAt:
          dto.published === undefined
            ? undefined
            : nextPublished
              ? existing.published
                ? undefined
                : new Date()
              : null,
      },
      select: this.baseSelect,
    });

    return this.toView(updated);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.client.announcement.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Announcement not found');

    await this.prisma.client.announcement.delete({
      where: { id },
    });
  }
}
