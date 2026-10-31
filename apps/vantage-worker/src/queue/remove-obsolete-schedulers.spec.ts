import { describe, expect, it, vi } from "vitest";
import { removeObsoleteSchedulers } from "./remove-obsolete-schedulers";

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

describe("removeObsoleteSchedulers", () => {
  it("removes every legacy intraday schedule by its Redis repeat key", async () => {
    const { queue, removeJobScheduler } = queueWith([
      { key: "sweep-key", name: "sweep" },
      { key: "intraday-default", name: "generate-intraday-coupons" },
      { key: "intraday-custom", name: "generate-intraday-coupons" },
    ]);

    const removed = await removeObsoleteSchedulers(queue, {
      couponCron: "45 17 * * *",
    });

    expect(removed).toBe(2);
    expect(removeJobScheduler).toHaveBeenNthCalledWith(1, "intraday-default");
    expect(removeJobScheduler).toHaveBeenNthCalledWith(2, "intraday-custom");
  });

  it("keeps the coupon pass at the current hour, removes the 20:30 pass and the 21:15 retry", async () => {
    const { queue, removeJobScheduler } = queueWith([
      { key: "now", name: "generate-coupons", pattern: "45 17 * * *" },
      { key: "old", name: "generate-coupons", pattern: "30 20 * * *" },
      { key: "retry", name: "generate-coupons", pattern: "15 21 * * *" },
    ]);

    const removed = await removeObsoleteSchedulers(queue, {
      couponCron: "45 17 * * *",
    });

    expect(removed).toBe(2);
    expect(removeJobScheduler.mock.calls.map(([key]) => key)).toEqual([
      "old",
      "retry",
    ]);
  });
});
