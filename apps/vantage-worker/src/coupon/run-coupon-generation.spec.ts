import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveGenerationWindow,
  runComposePersistPass,
} from "./run-coupon-generation";

vi.mock("./compose-coupon-class", () => ({
  composeCouponClass: vi.fn(),
}));
vi.mock("./compose-deterministic-shadow", () => ({
  buildDeterministicShadowAttempt: vi.fn().mockReturnValue({
    forDate: new Date("2026-10-01T00:00:00.000Z"),
    pass: "EVENING",
    outcome: "SHADOW_ABSTAINED",
    candidateCount: 0,
    policyVersion: "shadow",
  }),
}));
vi.mock("./persist-coupon-proposal", () => ({
  persistCouponProposal: vi.fn(),
}));
vi.mock("./record-generation-attempt", () => ({
  recordGenerationAttempt: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./score-candidates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./score-candidates")>()),
  candidatesForCouponClass: vi.fn().mockReturnValue([{}, {}, {}]),
}));

import { composeCouponClass } from "./compose-coupon-class";
import { recordGenerationAttempt } from "./record-generation-attempt";

const silentLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as import("pino").Logger;

describe("runComposePersistPass — LLM failure", () => {
  beforeEach(() => {
    vi.mocked(recordGenerationAttempt).mockClear();
  });

  it("records an ERROR attempt with the candidate count, then rethrows", async () => {
    vi.mocked(composeCouponClass).mockRejectedValueOnce(
      new Error("provider quota exhausted"),
    );
    const forDate = new Date("2026-10-01T00:00:00.000Z");

    await expect(
      runComposePersistPass(
        [],
        forDate,
        {} as never,
        silentLogger,
        {},
        { pass: "EVENING" },
      ),
    ).rejects.toThrow("provider quota exhausted");

    const attempts = vi
      .mocked(recordGenerationAttempt)
      .mock.calls.map(([attempt]) => attempt);
    const error = attempts.find((a) => a.outcome === "ERROR");
    expect(error).toMatchObject({
      forDate,
      pass: "EVENING",
      candidateCount: 3,
      reason: "provider quota exhausted",
    });
  });
});

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
