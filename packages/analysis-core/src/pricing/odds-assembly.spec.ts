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

describe("assembleFullOddsSnapshot — marge payée et meilleure marge (E-5)", () => {
  it("calcule la surcote du groupe complet chez le book retenu et la plus basse du relevé", () => {
    const at = new Date("2026-08-09T11:00:00.000Z");
    const rows = [
      // Pinnacle : 2.00 / 3.50 / 4.00 → overround 1.0357 → marge 3,57 %
      oneXTwoRow({
        bookmaker: "Pinnacle",
        snapshotAt: at,
        homeOdds: 2.0,
        drawOdds: 3.5,
        awayOdds: 4.0,
      }),
      // Bet365 : 1.90 / 3.40 / 3.80 → overround 1.0836 → marge 8,36 %
      oneXTwoRow({
        bookmaker: "Bet365",
        snapshotAt: at,
        homeOdds: 1.9,
        drawOdds: 3.4,
        awayOdds: 3.8,
      }),
      // O/U 2.5 : Bet365 cote les deux côtés, Pinnacle un seul → groupe
      // incomplet chez Pinnacle, meilleure marge = Bet365.
      pickRow({
        bookmaker: "Bet365",
        market: Market.OVER_UNDER,
        pick: "OVER",
        odds: 1.9,
        snapshotAt: at,
      }),
      pickRow({
        bookmaker: "Bet365",
        market: Market.OVER_UNDER,
        pick: "UNDER",
        odds: 1.9,
        snapshotAt: at,
      }),
      pickRow({
        bookmaker: "Pinnacle",
        market: Market.OVER_UNDER,
        pick: "OVER",
        odds: 1.95,
        snapshotAt: at,
      }),
    ];
    const snapshot = assembleFullOddsSnapshot(rows, CUTOFF);
    const home = snapshot?.sources?.["ONE_X_TWO:HOME"];
    expect(home?.bookmaker).toBe("Pinnacle");
    expect(home?.margin?.toNumber()).toBeCloseTo(
      1 / 2 + 1 / 3.5 + 1 / 4 - 1,
      10,
    );
    expect(home?.bestMargin?.toNumber()).toBeCloseTo(
      1 / 2 + 1 / 3.5 + 1 / 4 - 1,
      10,
    );

    // OVER à 1.95 vient de Pinnacle (mieux classé au même instant), qui ne
    // cote pas UNDER : marge payée inconnue, meilleure marge = Bet365.
    const over = snapshot?.sources?.["OVER_UNDER:OVER"];
    expect(over?.bookmaker).toBe("Pinnacle");
    expect(over?.margin).toBeNull();
    expect(over?.bestMargin?.toNumber()).toBeCloseTo(2 / 1.9 - 1, 10);
  });
});
