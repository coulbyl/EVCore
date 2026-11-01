import { Injectable } from '@nestjs/common';
import { createLogger } from '@utils/logger';
import { AdminJournalRepository } from './admin-journal.repository';
import type { AdminActionEntry, AdminActionView } from './admin-journal.types';

const logger = createLogger('admin-journal');

/**
 * The admin's one journal (12-admin.md § 4): who, when, before, after,
 * why. Written after the action succeeded; a failed write is logged and
 * never undoes the action it records.
 */
@Injectable()
export class AdminJournalService {
  constructor(private readonly repository: AdminJournalRepository) {}

  async record(entry: AdminActionEntry): Promise<void> {
    try {
      await this.repository.create(entry);
    } catch (err) {
      logger.error(
        { err, kind: entry.kind, target: entry.target },
        'Journal write failed',
      );
    }
  }

  list(input: { actorId?: string; take?: number }): Promise<AdminActionView[]> {
    return this.repository.list({
      actorId: input.actorId,
      take: input.take ?? 100,
    });
  }

  actors(): Promise<{ id: string; name: string }[]> {
    return this.repository.actors();
  }
}
