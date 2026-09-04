import { describe, expect, it } from "vitest";
import { resolveGenerationWindow } from "./run-coupon-generation";

describe("resolveGenerationWindow", () => {
  it("widens a Friday to the following Sunday (weekend window)", () => {
    // 2026-09-04 is a Friday.
    expect(resolveGenerationWindow("2026-09-04")).toEqual({
      to: "2026-09-06",
    });
  });

  it("widens a Tuesday to the following Thursday (midweek window)", () => {
    // 2026-09-01 is a Tuesday.
    expect(resolveGenerationWindow("2026-09-01")).toEqual({
      to: "2026-09-03",
    });
  });

  it("keeps every other day single-day", () => {
    // 2026-09-02 is a Wednesday.
    expect(resolveGenerationWindow("2026-09-02")).toEqual({
      to: "2026-09-02",
    });
    // 2026-09-06 is a Sunday.
    expect(resolveGenerationWindow("2026-09-06")).toEqual({
      to: "2026-09-06",
    });
  });
});
