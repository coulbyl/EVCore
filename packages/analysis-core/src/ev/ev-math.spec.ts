import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { bookmakerMargin, calculateEV, removeOverround } from "./ev-math";

describe("calculateEV", () => {
  it("applies EV = probability × odds − 1", () => {
    expect(calculateEV(0.5, 2.2).toNumber()).toBeCloseTo(0.1, 10);
  });

  it("is exactly 0 at fair odds", () => {
    expect(calculateEV(0.5, 2).toNumber()).toBe(0);
  });

  it("is negative when the price does not cover the probability", () => {
    expect(calculateEV(0.4, 2).toNumber()).toBeCloseTo(-0.2, 10);
  });
});

describe("bookmakerMargin", () => {
  it("returns 0 for a fair two-way book", () => {
    expect(bookmakerMargin([2, 2]).toNumber()).toBe(0);
  });

  it("returns the overround for a margined book", () => {
    // 1/1.9 + 1/1.9 = 1.0526… → margin ≈ 0.0526
    expect(bookmakerMargin([1.9, 1.9]).toNumber()).toBeCloseTo(0.05263, 4);
  });

  it("throws on empty input and on odds ≤ 1", () => {
    expect(() => bookmakerMargin([])).toThrow(RangeError);
    expect(() => bookmakerMargin([1, 2])).toThrow(RangeError);
  });
});

describe("removeOverround", () => {
  it("returns fair probabilities that sum to exactly 1", () => {
    const fair = removeOverround([1.9, 3.6, 4.2]);
    const sum = fair.reduce((a, p) => a.plus(p), new Decimal(0));
    expect(sum.toNumber()).toBeCloseTo(1, 12);
  });

  it("throws on empty input and on odds ≤ 1", () => {
    expect(() => removeOverround([])).toThrow(RangeError);
    expect(() => removeOverround([0.5])).toThrow(RangeError);
  });
});
