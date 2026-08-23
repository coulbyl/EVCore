import { describe, it, expect } from "vitest";
import { Market } from "../types";
import { assembleFullOddsSnapshot, type RawOddsRow } from "./odds-assembly";

// Regression coverage for the shared odds-assembly pure function, moved here
// 2026-08-17 from apps/backend's OddsSnapshotLoader so both the live betting
// engine and the backtest harness are provably covered by the same tests as
// the same code (docs/backtest-harness-architecture.md).

const CUTOFF = new Date("2026-08-09T12:00:00.000Z");

function oneXTwoRow(input: {
  bookmaker: string;
  snapshotAt: Date;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
}): RawOddsRow {
  return {
    bookmaker: input.bookmaker,
    market: Market.ONE_X_TWO,
    pick: null,
    odds: null,
    snapshotAt: input.snapshotAt,
    homeOdds: input.homeOdds,
    drawOdds: input.drawOdds,
    awayOdds: input.awayOdds,
  };
}

function pickRow(input: {
  bookmaker: string;
  market: Market;
  pick: string;
  odds: number;
  snapshotAt: Date;
}): RawOddsRow {
  return {
    bookmaker: input.bookmaker,
    market: input.market,
    pick: input.pick,
    odds: input.odds,
    snapshotAt: input.snapshotAt,
    homeOdds: null,
    drawOdds: null,
    awayOdds: null,
  };
}

describe("assembleFullOddsSnapshot", () => {
  it("returns null when no ONE_X_TWO row exists at or before cutoff", () => {
    const snapshot = assembleFullOddsSnapshot(
      [
        oneXTwoRow({
          bookmaker: "Pinnacle",
          snapshotAt: new Date("2026-08-10T00:00:00.000Z"), // after cutoff
          homeOdds: 1.8,
          drawOdds: 3.4,
          awayOdds: 4.2,
        }),
      ],
      CUTOFF,
    );
    expect(snapshot).toBeNull();
  });

  it("never leaks a non-ONE_X_TWO price recorded after cutoff (2026-08-17 point-in-time fix)", () => {
    const beforeCutoff = new Date("2026-08-09T06:00:00.000Z");
    const afterCutoff = new Date("2026-08-10T00:00:00.000Z");
    const snapshot = assembleFullOddsSnapshot(
      [
        oneXTwoRow({
          bookmaker: "Bet365",
          snapshotAt: beforeCutoff,
          homeOdds: 1.9,
          drawOdds: 3.3,
          awayOdds: 4.0,
        }),
        pickRow({
          bookmaker: "Bet365",
          market: Market.OVER_UNDER,
          pick: "OVER",
          odds: 1.9,
          snapshotAt: afterCutoff,
        }),
        pickRow({
          bookmaker: "Bet365",
          market: Market.BTTS,
          pick: "YES",
          odds: 1.8,
          snapshotAt: afterCutoff,
        }),
      ],
      CUTOFF,
    );
    expect(snapshot?.overUnderOdds.OVER).toBeUndefined();
    expect(snapshot?.bttsYesOdds).toBeNull();
  });

  it("resolves each OVER_UNDER line independently instead of one bookmaker for the whole market", () => {
    const earlier = new Date("2026-08-09T06:00:00.000Z");
    const latest = new Date("2026-08-09T08:00:00.000Z");
    const snapshot = assembleFullOddsSnapshot(
      [
        oneXTwoRow({
          bookmaker: "Bet365",
          snapshotAt: latest,
          homeOdds: 1.9,
          drawOdds: 3.3,
          awayOdds: 4.0,
        }),
        pickRow({
          bookmaker: "Bet365",
          market: Market.OVER_UNDER,
          pick: "OVER_3_5",
          odds: 2.5,
          snapshotAt: latest,
        }),
        // Unibet only quotes the 2.5 line, at an earlier snapshot — must not
        // be dropped just because Bet365 is the market-wide latest bookmaker.
        pickRow({
          bookmaker: "Unibet",
          market: Market.OVER_UNDER,
          pick: "OVER",
          odds: 1.28,
          snapshotAt: earlier,
        }),
      ],
      CUTOFF,
    );
    expect(snapshot?.overUnderOdds.OVER_3_5?.toNumber()).toBe(2.5);
    expect(snapshot?.overUnderOdds.OVER?.toNumber()).toBe(1.28);
  });
});
