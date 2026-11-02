import { describe, expect, it, vi } from 'vitest';
import { AdminJournalService, maskEmail } from './admin-journal.service';
import type { AdminJournalRepository } from './admin-journal.repository';

describe('AdminJournalService', () => {
  it('masks an address as the mockup writes it', () => {
    expect(maskEmail('aya@example.com')).toBe('aya@…');
    expect(maskEmail('not-an-email')).toBe('not-an-email');
  });

  it("rewrites a deleted account's lines to the masked address", async () => {
    const repository = { renameTarget: vi.fn(() => Promise.resolve()) };
    const journal = new AdminJournalService(
      repository as unknown as AdminJournalRepository,
    );
    expect(await journal.forgetEmail('aya@example.com')).toBe('aya@…');
    expect(repository.renameTarget).toHaveBeenCalledWith({
      target: 'aya@example.com',
      replacement: 'aya@…',
    });
  });

  it('a failed journal write never undoes the action', async () => {
    const repository = { create: vi.fn(() => Promise.reject(new Error('x'))) };
    const journal = new AdminJournalService(
      repository as unknown as AdminJournalRepository,
    );
    await expect(
      journal.record({ actorId: 'u1', kind: 'setting', target: 'k' }),
    ).resolves.toBeUndefined();
  });
});
