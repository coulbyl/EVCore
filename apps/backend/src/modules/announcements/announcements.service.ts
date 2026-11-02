import { AdminJournalService } from '@modules/admin-journal/admin-journal.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PushService } from '@modules/push/push.service';
import { NotificationService } from '@modules/notification/notification.service';
import type { CreateAnnouncementDto } from './dto/create-announcement.dto';
import type { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import {
  AnnouncementsRepository,
  type AnnouncementRecord,
} from './announcements.repository';

export type AnnouncementView = {
  id: string;
  title: string;
  description: string;
  href: string | null;
  published: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    username: string | null;
    fullName: string;
  } | null;
};

export type UserAnnouncementView = AnnouncementView & { isRead: boolean };

/** The team's view: how many players read it. */
export type AdminAnnouncementView = AnnouncementView & { reads: number };

@Injectable()
export class AnnouncementsService {
  // eslint-disable-next-line max-params -- NestJS constructor injection: the table, the push, the bell, the journal
  constructor(
    private readonly repository: AnnouncementsRepository,
    private readonly push: PushService,
    private readonly notification: NotificationService,
    private readonly journal: AdminJournalService,
  ) {}

  private toView(announcement: AnnouncementRecord): AnnouncementView {
    return {
      id: announcement.id,
      title: announcement.title,
      description: announcement.description,
      href: announcement.href,
      published: announcement.published,
      publishedAt: announcement.publishedAt?.toISOString() ?? null,
      expiresAt: announcement.expiresAt?.toISOString() ?? null,
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

  private async notifyPublished(
    announcement: Pick<
      AnnouncementRecord,
      'id' | 'title' | 'description' | 'href'
    >,
    excludeUserId: string,
  ): Promise<void> {
    await Promise.all([
      this.push.sendToAllUsers(
        {
          title: announcement.title,
          body: announcement.description,
          url: announcement.href ?? '/notifications',
        },
        excludeUserId,
      ),
      this.notification.sendAnnouncementPublished({
        announcementId: announcement.id,
        title: announcement.title,
        body: announcement.description,
        href: announcement.href,
      }),
    ]);
  }

  async listPublished(): Promise<AnnouncementView[]> {
    const items = await this.repository.listLive({ now: new Date() });
    return items.map((item) => this.toView(item));
  }

  // Same scope as listPublished, plus per-user read state (doc §7.1/§7.2) —
  // powers the user-facing history page, replacing the localStorage
  // dismissed-ids store the dashboard banner used to rely on alone.
  async listPublishedForUser(userId: string): Promise<UserAnnouncementView[]> {
    const items = await this.repository.listLive({ now: new Date(), userId });
    return items.map((item) => ({
      ...this.toView(item),
      isRead: (item.reads ?? []).length > 0,
    }));
  }

  async markRead(userId: string, announcementId: string): Promise<void> {
    const exists = await this.repository.findState(announcementId);
    if (!exists) throw new NotFoundException('Announcement not found');
    await this.repository.markRead({ userId, announcementId });
    await this.notification.markAnnouncementRead(userId, announcementId);
  }

  async listAdmin(): Promise<AdminAnnouncementView[]> {
    const items = await this.repository.listAll();
    return items.map((item) => ({
      ...this.toView(item),
      reads: item._count.reads,
    }));
  }

  async create(
    userId: string,
    dto: CreateAnnouncementDto,
  ): Promise<AnnouncementView> {
    const created = await this.repository.create({
      title: dto.title.trim(),
      description: dto.description,
      href: dto.href?.trim() || null,
      published: dto.published ?? false,
      publishedAt: dto.published ? new Date() : null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      createdById: userId,
    });

    if (created.published) {
      await this.notifyPublished(created, userId);
      await this.journal.record({
        actorId: userId,
        kind: 'announcement',
        target: created.title,
      });
    }

    return this.toView(created);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateAnnouncementDto,
  ): Promise<AnnouncementView> {
    const existing = await this.repository.findState(id);
    if (!existing) throw new NotFoundException('Announcement not found');

    const nextPublished =
      dto.published !== undefined ? dto.published : existing.published;

    const updated = await this.repository.update({
      id,
      data: {
        title: dto.title?.trim(),
        description: dto.description,
        href: dto.href !== undefined ? dto.href.trim() || null : undefined,
        published: dto.published,
        publishedAt:
          dto.published === undefined
            ? undefined
            : nextPublished
              ? existing.published
                ? undefined
                : new Date()
              : null,
        expiresAt:
          dto.expiresAt !== undefined
            ? dto.expiresAt
              ? new Date(dto.expiresAt)
              : null
            : undefined,
      },
    });

    // Only the unpublished → published transition is a "new announcement"
    // moment — editing text on an already-published one, or unpublishing it,
    // shouldn't re-notify everyone.
    if (nextPublished && !existing.published) {
      await this.notifyPublished(updated, userId);
      await this.journal.record({
        actorId: userId,
        kind: 'announcement',
        target: updated.title,
      });
    } else if (!nextPublished && existing.published) {
      await this.journal.record({
        actorId: userId,
        kind: 'announcement_withdrawn',
        target: updated.title,
      });
    }

    return this.toView(updated);
  }

  async remove(input: { id: string; actorId: string }): Promise<void> {
    const existing = await this.repository.findState(input.id);
    if (!existing) throw new NotFoundException('Announcement not found');
    await this.repository.delete(input.id);
    await this.journal.record({
      actorId: input.actorId,
      kind: 'announcement_deleted',
      target: existing.title,
    });
  }
}
