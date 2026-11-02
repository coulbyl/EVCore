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
  it("keeps the two fixed-key schedulers", async () => {
    const { queue, removeJobScheduler } = queueWith([
      { key: VANTAGE_SCHEDULERS.sweep.id, name: "sweep" },
      {
        key: VANTAGE_SCHEDULERS.coupons.id,
        name: "generate-coupons",
        pattern: "45 17 * * *",
      },
    ]);

    expect(await removeObsoleteSchedulers(queue)).toBe(0);
    expect(removeJobScheduler).not.toHaveBeenCalled();
  });

  it("removes the repeatables of before the schedulers, whose hashed keys would fire twice", async () => {
    const { queue, removeJobScheduler } = queueWith([
      { key: VANTAGE_SCHEDULERS.sweep.id, name: "sweep" },
      { key: "sweep:vantage-recurring-sweep::30000", name: "sweep" },
      {
        key: VANTAGE_SCHEDULERS.coupons.id,
        name: "generate-coupons",
        pattern: "45 17 * * *",
      },
      { key: "old-1745", name: "generate-coupons", pattern: "45 17 * * *" },
      { key: "old-2030", name: "generate-coupons", pattern: "30 20 * * *" },
      { key: "retry-2115", name: "generate-coupons", pattern: "15 21 * * *" },
    ]);

    expect(await removeObsoleteSchedulers(queue)).toBe(4);
    expect(removedKeys(removeJobScheduler)).toEqual([
      "sweep:vantage-recurring-sweep::30000",
      "old-1745",
      "old-2030",
      "retry-2115",
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
