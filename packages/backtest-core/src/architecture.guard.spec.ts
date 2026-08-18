import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// backtest-core's whole value is "one place data can leak from the future,
// tested once" (docs/backtest-harness-architecture.md §5) — not "no
// infrastructure at all" like analysis-core (this package DOES read
// Postgres). Two invariants, both enforced here instead of by review:
//
// 1. Only point-in-time-loader.ts may import @evcore/db. Every other file
//    must go through PointInTimeLoader — so a script or a future
//    replay-engine.ts literally cannot bypass the `asOf` gate.
// 2. No NestJS/BullMQ/ioredis/process.env — this package runs as a plain
//    CLI-callable library, never boots a framework, never reaches into env
//    vars directly (any config it needs is passed in by its caller).
const POINT_IN_TIME_LOADER_FILE = "point-in-time-loader.ts";

const GLOBAL_FORBIDDEN: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "NestJS", pattern: /from\s+['"]@nestjs\// },
  { label: "ioredis", pattern: /from\s+['"]ioredis['"]/ },
  { label: "BullMQ", pattern: /from\s+['"]bullmq['"]/ },
  { label: "process.env", pattern: /process\.env/ },
];

const DB_IMPORT_PATTERN = /from\s+['"]@evcore\/db['"]/;

const SRC_DIR = join(__dirname);

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (!entry.endsWith(".ts")) continue;
    if (entry.endsWith(".spec.ts")) continue; // tests may use node:fs etc.
    out.push(full);
  }
  return out;
}

describe("backtest-core architecture boundary", () => {
  const files = collectSourceFiles(SRC_DIR);

  it("finds source files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(GLOBAL_FORBIDDEN)("forbids $label imports anywhere", ({ pattern }) => {
    const offenders = files.filter((file) =>
      pattern.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("forbids @evcore/db imports outside point-in-time-loader.ts", () => {
    const offenders = files
      .filter((file) => !file.endsWith(POINT_IN_TIME_LOADER_FILE))
      .filter((file) => DB_IMPORT_PATTERN.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("point-in-time-loader.ts does import @evcore/db (sanity — the guard above isn't vacuous)", () => {
    const loaderFile = files.find((file) =>
      file.endsWith(POINT_IN_TIME_LOADER_FILE),
    );
    expect(loaderFile).toBeDefined();
    expect(DB_IMPORT_PATTERN.test(readFileSync(loaderFile!, "utf8"))).toBe(
      true,
    );
  });
});
