import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The whole value of analysis-core is that it is pure: prod and backtest import
// the SAME code, and it builds + tests with zero infrastructure. This test fails
// the build the moment any source file reaches for DB / HTTP / Redis / NestJS /
// BullMQ or process.env — keeping the boundary honest without relying on review.
const FORBIDDEN: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: 'NestJS', pattern: /from\s+['"]@nestjs\// },
  { label: 'Prisma client (@evcore/db)', pattern: /from\s+['"]@evcore\/db['"]/ },
  { label: 'Prisma', pattern: /from\s+['"]@prisma\// },
  { label: 'ioredis', pattern: /from\s+['"]ioredis['"]/ },
  { label: 'BullMQ', pattern: /from\s+['"]bullmq['"]/ },
  { label: 'process.env', pattern: /process\.env/ },
];

const SRC_DIR = join(__dirname);

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (!entry.endsWith('.ts')) continue;
    if (entry.endsWith('.spec.ts')) continue; // tests may use node:fs etc.
    out.push(full);
  }
  return out;
}

describe('analysis-core architecture boundary', () => {
  const files = collectSourceFiles(SRC_DIR);

  it('finds source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(FORBIDDEN)('forbids $label imports', ({ pattern }) => {
    const offenders = files.filter((file) =>
      pattern.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
