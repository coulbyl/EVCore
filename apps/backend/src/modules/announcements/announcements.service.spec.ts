import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import type { AdminJournalService } from '@modules/admin-journal/admin-journal.service';
import type { NotificationService } from '@modules/notification/notification.service';
import type { AnnouncementsRepository } from './announcements.repository';
import { AnnouncementsService } from './announcements.service';

const NOW = new Date('2026-11-01T10:00:00Z');

function record(over: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    title: 'Nouveau : le Chasseur Corners',
    description: '<p>Un nouveau pari.</p>',
    href: null,
    published: false,
    publishedAt: null,
    expiresAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: null,
    ...over,
  };
}

function harness(state: { published: boolean } | null) {
  const repository = {
    findState: vi.fn(() =>
      Promise.resolve(state ? { id: 'a1', title: 'Corners', ...state } : null),
    ),
    update: vi.fn(({ data }: { data: { published?: boolean } }) =>
      Promise.resolve(
        record({ published: data.published ?? state?.published }),
      ),
    ),
    delete: vi.fn(() => Promise.resolve()),
    listAll: vi.fn(() =>
      Promise.resolve([
        { ...record({ published: true }), _count: { reads: 12 } },
      ]),
    ),
  };
  // The bell's row and the push both go through deliverAnnouncement.
  const notification = {
    deliverAnnouncement: vi.fn(() => Promise.resolve()),
  };
  const journal = { record: vi.fn(() => Promise.resolve()) };
  const service = new AnnouncementsService(
    repository as unknown as AnnouncementsRepository,
    notification as unknown as NotificationService,
    journal as unknown as AdminJournalService,
  );
  return { service, repository, notification, journal };
}

describe('AnnouncementsService (team side)', () => {
  it('lists every announcement with how many players read it', async () => {
    const { service } = harness(null);
    const [item] = await service.listAdmin();
    expect(item?.reads).toBe(12);
  });

  it('publishing a draft notifies the players and journals it', async () => {
    const { service, notification, journal } = harness({ published: false });
    await service.update('a1', 'u1', { published: true });
    expect(notification.deliverAnnouncement).toHaveBeenCalledTimes(1);
    expect(journal.record).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'announcement' }),
    );
  });

  it('unpublishing notifies nobody and journals it', async () => {
    const { service, notification, journal } = harness({ published: true });
    await service.update('a1', 'u1', { published: false });
    expect(notification.deliverAnnouncement).not.toHaveBeenCalled();
    expect(journal.record).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'announcement_withdrawn' }),
    );
  });

  it('editing a published text notifies nobody again', async () => {
    const { service, notification, journal } = harness({ published: true });
    await service.update('a1', 'u1', { title: 'Corners, mis à jour' });
    expect(notification.deliverAnnouncement).not.toHaveBeenCalled();
    expect(journal.record).not.toHaveBeenCalled();
  });

  it('deleting journals the title; an unknown one is 404', async () => {
    const { service, repository, journal } = harness({ published: true });
    await service.remove({ id: 'a1', actorId: 'u1' });
    expect(repository.delete).toHaveBeenCalledWith('a1');
    expect(journal.record).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'announcement_deleted',
        target: 'Corners',
      }),
    );
    const missing = harness(null);
    await expect(
      missing.service.remove({ id: 'x', actorId: 'u1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
