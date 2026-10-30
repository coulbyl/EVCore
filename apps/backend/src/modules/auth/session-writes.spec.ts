import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Sessions are cached in memory (session-cache.ts): every write to a user or
// a session must invalidate that user's cached sessions, or a pause, a
// suspension or a role change goes unseen for up to a minute. Writes are
// therefore kept in these repositories, whose callers invalidate after each
// one (and their specs check it).
const ALLOWED_WRITERS = [
  'modules/admin-users/admin-users.repository.ts',
  'modules/auth/account.repository.ts',
  'modules/auth/auth.repository.ts',
];

const WRITE =
  /\.(user|session)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/;
const RAW_WRITE =
  /(update|delete\s+from|insert\s+into)\s+"?(users?|sessions?)"?\b/i;

const SRC = join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')
      ? [path]
      : [];
  });
}

describe('user and session writes', () => {
  it('only happen in the repositories whose callers invalidate the session cache', () => {
    const writers = sourceFiles(SRC)
      .filter((file) => {
        const text = readFileSync(file, 'utf8');
        return WRITE.test(text) || RAW_WRITE.test(text);
      })
      .map((file) => relative(SRC, file))
      .sort();
    expect(
      writers,
      'A new file writes users or sessions: call SessionCache.invalidateUser after the write, then list the file here.',
    ).toEqual(ALLOWED_WRITERS);
  });
});
