import { describe, expect, it, vi } from "vitest";
import {
  removeObsoleteSchedulers,
  VANTAGE_SCHEDULERS,
} from "./remove-obsolete-schedulers";

function queueWith(
  schedulers: { key: string; name: string; pattern?: string }[],
) {
  const removeJobScheduler = vi.fn().mockResolvedValue(true);
  return {
    queue: {
      getJobSchedulers: vi.fn().mockResolvedValue(schedulers),
      removeJobScheduler,
    },
    removeJobScheduler,
  };
}

const removedKeys = (mock: ReturnType<typeof vi.fn>) =>
  mock.mock.calls.map(([key]) => key as string);

describe("removeObsoleteSchedulers", () => {
  it("keeps the sweep's fixed-key scheduler", async () => {
    const { queue, removeJobScheduler } = queueWith([
      { key: VANTAGE_SCHEDULERS.sweep.id, name: "sweep" },
    ]);

    expect(await removeObsoleteSchedulers(queue)).toBe(0);
    expect(removeJobScheduler).not.toHaveBeenCalled();
  });

  it("removes a sweep repeatable of before the schedulers, whose hashed key would fire twice", async () => {
    const { queue, removeJobScheduler } = queueWith([
      { key: VANTAGE_SCHEDULERS.sweep.id, name: "sweep" },
      { key: "sweep:vantage-recurring-sweep::30000", name: "sweep" },
    ]);

    expect(await removeObsoleteSchedulers(queue)).toBe(1);
    expect(removedKeys(removeJobScheduler)).toEqual([
      "sweep:vantage-recurring-sweep::30000",
    ]);
  });

  it("removes every LLM combo schedule, cut on 2026-11-03", async () => {
    const { queue, removeJobScheduler } = queueWith([
      { key: VANTAGE_SCHEDULERS.sweep.id, name: "sweep" },
      {
        key: "vantage-recurring-coupon-generation",
        name: "generate-coupons",
        pattern: "45 17 * * *",
      },
      { key: "old-2030", name: "generate-coupons", pattern: "30 20 * * *" },
    ]);

    expect(await removeObsoleteSchedulers(queue)).toBe(2);
    expect(removedKeys(removeJobScheduler)).toEqual([
      "vantage-recurring-coupon-generation",
      "old-2030",
    ]);
  });

  it("removes every legacy intraday schedule", async () => {
    const { queue, removeJobScheduler } = queueWith([
      { key: "intraday-default", name: "generate-intraday-coupons" },
      { key: "intraday-custom", name: "generate-intraday-coupons" },
    ]);

    expect(await removeObsoleteSchedulers(queue)).toBe(2);
    expect(removedKeys(removeJobScheduler)).toEqual([
      "intraday-default",
      "intraday-custom",
    ]);
  });

  it("leaves a job it does not own", async () => {
    const { queue, removeJobScheduler } = queueWith([
      { key: "other", name: "analyze-fixture" },
    ]);
    expect(await removeObsoleteSchedulers(queue)).toBe(0);
    expect(removeJobScheduler).not.toHaveBeenCalled();
  });
});
