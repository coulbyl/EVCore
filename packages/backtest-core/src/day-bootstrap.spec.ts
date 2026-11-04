import { describe, expect, it } from "vitest";
import { bootstrapDaySums, meanCi, mulberry32 } from "./day-bootstrap";

// The variant the market-grid replay carried before the shared module: the
// same generator written with unsigned arithmetic. Same sequence required,
// or the published intervals would move.
function unsignedMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("mulberry32", () => {
  it("is the same sequence as the unsigned variant", () => {
    const a = mulberry32(20261104);
    const b = unsignedMulberry32(20261104);
    for (let i = 0; i < 10_000; i++) expect(a()).toBe(b());
  });
});

describe("meanCi", () => {
  it("brackets the mean and is reproducible", () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      day: `d${i % 20}`,
      value: (i % 7) / 7,
    }));
    const options = { draws: 500, seed: 1 };
    const ci = meanCi(rows, options);
    expect(ci.lo).toBeLessThanOrEqual(ci.mean);
    expect(ci.hi).toBeGreaterThanOrEqual(ci.mean);
    expect(meanCi(rows, options)).toEqual(ci);
    expect(meanCi([], options).mean).toBeNaN();
  });
});

describe("bootstrapDaySums", () => {
  it("computes the statistic on all days and brackets it", () => {
    const days = Array.from({ length: 30 }, (_, i) => [i % 3 === 0 ? 1 : 0, 1]);
    const ratio = (s: number[]) => (s[0] ?? 0) / (s[1] ?? 1);
    const r = bootstrapDaySums(days, ratio, { draws: 400, seed: 7 });
    expect(r.value).toBeCloseTo(10 / 30, 12);
    expect(r.lo).toBeLessThanOrEqual(r.value);
    expect(r.hi).toBeGreaterThanOrEqual(r.value);
  });
});
