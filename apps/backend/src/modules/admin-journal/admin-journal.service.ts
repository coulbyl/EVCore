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

  /**
   * A deleted account leaves no address behind: its lines keep « aya@… »
   * (the mockup's form), enough to read the journal, not to reach anyone.
   */
  async forgetEmail(email: string): Promise<string> {
    const masked = maskEmail(email);
    try {
      await this.repository.renameTarget({
        target: email,
        replacement: masked,
      });
    } catch (err) {
      logger.error({ err }, 'Journal could not forget an address');
    }
    return masked;
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

/** « aya@example.com » → « aya@… ». */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  return at > 0 ? `${email.slice(0, at)}@…` : email;
}
