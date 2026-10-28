import { describe, expect, it } from "vitest";
import { formatMoney } from "./money";

// Espaces du format français : insécable fine entre milliers (Intl),
// insécable avant le symbole.
const n = (s: string) => s.replace(/[\u00A0\u202F]/g, " ");

describe("formatMoney", () => {
  it("writes francs CFA without centimes, rounding half away from zero", () => {
    expect(n(formatMoney(1540))).toBe("1 540 F");
    expect(n(formatMoney("537.6"))).toBe("538 F");
    expect(n(formatMoney(-462.5))).toBe("-463 F");
    expect(n(formatMoney(462.5))).toBe("463 F");
  });

  it("never writes minus zero, signs only on request", () => {
    expect(n(formatMoney(-0.4))).toBe("0 F");
    expect(n(formatMoney(-0.4, { signed: true }))).toBe("0 F");
    expect(n(formatMoney(660, { signed: true }))).toBe("+660 F");
    expect(n(formatMoney(-460, { signed: true }))).toBe("-460 F");
  });

  it("keeps two decimals at most for euros and puts the dollar first", () => {
    expect(n(formatMoney(12.5, { currency: "EUR" }))).toBe("12,5 €");
    expect(n(formatMoney(-462.456, { currency: "USD" }))).toBe("-$462,46");
    expect(n(formatMoney(5, { currency: "USD", signed: true }))).toBe("+$5");
  });

  it("goes compact from a million only when asked", () => {
    expect(n(formatMoney(2_000_000))).toBe("2 000 000 F");
    expect(n(formatMoney(2_000_000, { compact: true }))).toBe("2 M F");
  });

  it("writes an unknown currency code as is and passes non-numbers through", () => {
    expect(n(formatMoney(10, { currency: "GHS" }))).toBe("10 GHS");
    expect(formatMoney("abc")).toBe("abc");
    expect(formatMoney(Number.NaN)).toBe("—");
  });
});
