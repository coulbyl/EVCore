import { describe, expect, it, vi } from "vitest";
import { removeObsoleteIntradaySchedulers } from "./remove-obsolete-schedulers";

describe("removeObsoleteIntradaySchedulers", () => {
  it("removes every legacy intraday schedule by its Redis repeat key", async () => {
    const removeJobScheduler = vi.fn().mockResolvedValue(true);
    const queue = {
      getJobSchedulers: vi.fn().mockResolvedValue([
        { key: "sweep-key", name: "sweep" },
        { key: "intraday-default", name: "generate-intraday-coupons" },
        { key: "intraday-custom", name: "generate-intraday-coupons" },
      ]),
      removeJobScheduler,
    };

    const removed = await removeObsoleteIntradaySchedulers(queue);

    expect(removed).toBe(2);
    expect(removeJobScheduler).toHaveBeenCalledTimes(2);
    expect(removeJobScheduler).toHaveBeenNthCalledWith(1, "intraday-default");
    expect(removeJobScheduler).toHaveBeenNthCalledWith(2, "intraday-custom");
  });
});
