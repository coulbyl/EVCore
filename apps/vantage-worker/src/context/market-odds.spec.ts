import { describe, expect, it } from "vitest";
import { Market } from "@evcore/analysis-core";
import { buildExtendedMarketOdds } from "./market-odds";

const decimal = (value: number) => ({ toNumber: () => value });

describe("buildExtendedMarketOdds", () => {
  it("keeps the latest fixed-outcome snapshot", () => {
    const old = new Date("2026-09-21T10:00:00Z");
    const latest = new Date("2026-09-21T11:00:00Z");
    const result = buildExtendedMarketOdds([
      {
        market: Market.ODD_EVEN,
        pick: "ODD",
        line: null,
        odds: decimal(1.8),
        snapshotAt: latest,
      },
      {
        market: Market.ODD_EVEN,
        pick: "EVEN",
        line: null,
        odds: decimal(2.05),
        snapshotAt: latest,
      },
      {
        market: Market.ODD_EVEN,
        pick: "ODD",
        line: null,
        odds: decimal(1.7),
        snapshotAt: old,
      },
    ]);

    expect(result).toEqual([
      {
        market: Market.ODD_EVEN,
        prices: [
          { pick: "ODD", odds: 1.8 },
          { pick: "EVEN", odds: 2.05 },
        ],
      },
    ]);
  });

  it("keeps only the most balanced complete line", () => {
    const snapshotAt = new Date("2026-09-21T11:00:00Z");
    const rows = [
      ["OVER", 8.5, 1.2],
      ["UNDER", 8.5, 4.2],
      ["OVER", 9.5, 1.92],
      ["UNDER", 9.5, 1.94],
      ["OVER", 10.5, 3.8],
      ["UNDER", 10.5, 1.25],
    ] as const;

    const result = buildExtendedMarketOdds(
      rows.map(([pick, line, odds]) => ({
        market: Market.CORNERS,
        pick,
        line: decimal(line),
        odds: decimal(odds),
        snapshotAt,
      })),
    );

    expect(result).toEqual([
      {
        market: Market.CORNERS,
        prices: [
          { pick: "OVER", odds: 1.92, line: 9.5 },
          { pick: "UNDER", odds: 1.94, line: 9.5 },
        ],
      },
    ]);
  });

  it("falls back to the latest complete snapshot when the newest is partial", () => {
    const latest = new Date("2026-09-21T12:00:00Z");
    const previous = new Date("2026-09-21T11:00:00Z");
    const result = buildExtendedMarketOdds([
      {
        market: Market.ASIAN_HANDICAP,
        pick: "HOME",
        line: decimal(-0.5),
        odds: decimal(1.91),
        snapshotAt: latest,
      },
      {
        market: Market.ASIAN_HANDICAP,
        pick: "HOME",
        line: decimal(-0.25),
        odds: decimal(1.93),
        snapshotAt: previous,
      },
      {
        market: Market.ASIAN_HANDICAP,
        pick: "AWAY",
        line: decimal(-0.25),
        odds: decimal(1.95),
        snapshotAt: previous,
      },
    ]);

    expect(result).toEqual([
      {
        market: Market.ASIAN_HANDICAP,
        prices: [
          { pick: "HOME", odds: 1.93, line: -0.25 },
          { pick: "AWAY", odds: 1.95, line: -0.25 },
        ],
      },
    ]);
  });
});
