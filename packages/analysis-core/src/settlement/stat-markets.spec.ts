import { describe, expect, it } from "vitest";
import { BetStatus, Market } from "../types";
import {
  resolveCorners1x2BetStatus,
  resolveGoalScorerBetStatus,
  resolveMinute1x2BetStatus,
  resolvePlayerShotsBetStatus,
  resolveStatMarketBetStatus,
  resolveTeamCornersBetStatus,
  scoreGoals,
  type MatchEventFact,
  type MatchFacts,
} from "./stat-markets";

const { WON, LOST, VOID } = BetStatus;

let ordinal = 0;
const goal = (
  side: "home" | "away",
  minute: number,
  scorer: number | null,
  extra: Partial<MatchEventFact> = {},
): MatchEventFact => ({
  side,
  ordinal: ordinal++,
  minute,
  extraMinute: null,
  type: "GOAL",
  detail: "Normal Goal",
  comments: null,
  playerExternalId: scorer,
  playerName: scorer === null ? "Unknown" : `Player ${scorer}`,
  assistExternalId: null,
  ...extra,
});
const sub = (
  side: "home" | "away",
  minute: number,
  off: number,
  on: number,
): MatchEventFact => ({
  side,
  ordinal: ordinal++,
  minute,
  extraMinute: null,
  type: "SUBSTITUTION",
  detail: "Substitution 1",
  comments: null,
  playerExternalId: off,
  playerName: `Player ${off}`,
  assistExternalId: on,
});

// Shaped on Arsenal – Aston Villa of the 03/11 sample: 1-1, Konsa 7',
// Gabriel 68'; two starters a side, one substitute who came on, one who
// did not.
function facts(overrides: Partial<MatchFacts> = {}): MatchFacts {
  return {
    score: { home: 1, away: 1 },
    teams: {
      home: { corners: 6, shotsTotal: 4, shotsOn: 2 },
      away: { corners: 3, shotsTotal: 2, shotsOn: 1 },
    },
    events: [
      goal("away", 7, 20),
      goal("home", 68, 11),
      sub("home", 68, 12, 13),
    ],
    lineups: [
      { side: "home", playerExternalId: 11, starter: true },
      { side: "home", playerExternalId: 12, starter: true },
      { side: "home", playerExternalId: 13, starter: false },
      { side: "home", playerExternalId: 14, starter: false },
      { side: "away", playerExternalId: 20, starter: true },
      { side: "away", playerExternalId: 21, starter: true },
    ],
    playerStats: [
      {
        side: "home",
        playerExternalId: 11,
        minutes: 90,
        shotsTotal: 2,
        shotsOn: 2,
      },
      {
        side: "home",
        playerExternalId: 12,
        minutes: 68,
        shotsTotal: null,
        shotsOn: 0,
      },
      {
        side: "home",
        playerExternalId: 13,
        minutes: 22,
        shotsTotal: 2,
        shotsOn: null,
      },
      {
        side: "home",
        playerExternalId: 14,
        minutes: null,
        shotsTotal: null,
        shotsOn: null,
      },
      {
        side: "away",
        playerExternalId: 20,
        minutes: 90,
        shotsTotal: 1,
        shotsOn: 1,
      },
      {
        side: "away",
        playerExternalId: 21,
        minutes: 90,
        shotsTotal: 1,
        shotsOn: 0,
      },
    ],
    ...overrides,
  };
}

describe("scoreGoals", () => {
  it("lists the goals of the score in order", () => {
    expect(scoreGoals(facts())?.map((g) => g.scorerExternalId)).toEqual([
      20, 11,
    ]);
  });

  it("leaves out a cancelled goal, shoot-out kicks, extra time and missed penalties", () => {
    const events = [
      goal("away", 7, 20),
      goal("home", 30, null, { playerName: null }),
      goal("home", 50, 12, { detail: "Missed Penalty" }),
      goal("home", 68, 11),
      goal("home", 105, 11),
      goal("home", 120, 11, {
        comments: "Penalty Shootout",
        detail: "Penalty",
      }),
    ];
    expect(scoreGoals(facts({ events }))).toHaveLength(2);
  });

  it("is unknown when the goals do not make the score, or nothing was reported", () => {
    expect(scoreGoals(facts({ events: [goal("home", 68, 11)] }))).toBeNull();
    expect(scoreGoals(facts({ events: null }))).toBeNull();
    expect(scoreGoals(facts({ score: null }))).toBeNull();
  });

  it("needs no event for a goalless score", () => {
    expect(
      scoreGoals(facts({ score: { home: 0, away: 0 }, events: null })),
    ).toEqual([]);
  });
});

describe("corners", () => {
  it("team corners over or under, an integer line met refunds, unknown waits", () => {
    expect(resolveTeamCornersBetStatus("OVER", 5.5, 6)).toBe(WON);
    expect(resolveTeamCornersBetStatus("UNDER", 5.5, 6)).toBe(LOST);
    expect(resolveTeamCornersBetStatus("OVER", 6, 6)).toBe(VOID);
    expect(resolveTeamCornersBetStatus("OVER", 4.5, null)).toBeNull();
  });

  it("corners 1X2: more corners wins, level is DRAW", () => {
    expect(resolveCorners1x2BetStatus("HOME", 6, 3)).toBe(WON);
    expect(resolveCorners1x2BetStatus("AWAY", 6, 3)).toBe(LOST);
    expect(resolveCorners1x2BetStatus("DRAW", 4, 4)).toBe(WON);
    expect(resolveCorners1x2BetStatus("HOME", 4, null)).toBeNull();
  });

  it("settles each side's line on its own team", () => {
    const f = facts();
    expect(
      resolveStatMarketBetStatus({
        market: Market.CORNERS_HOME,
        pick: "OVER",
        line: 5.5,
        facts: f,
      }),
    ).toBe(WON);
    expect(
      resolveStatMarketBetStatus({
        market: Market.CORNERS_AWAY,
        pick: "OVER",
        line: 5.5,
        facts: f,
      }),
    ).toBe(LOST);
    expect(
      resolveStatMarketBetStatus({
        market: Market.CORNERS_HOME,
        pick: "OVER",
        line: null,
        facts: f,
      }),
    ).toBe(VOID);
  });
});

describe("1X2 at a minute", () => {
  const at = (pick: string, minute: number, f = facts()) =>
    resolveMinute1x2BetStatus({ pick, minute, facts: f });

  it("counts the goals up to the minute, that minute included", () => {
    expect(at("DRAW", 6)).toBe(WON);
    expect(at("AWAY", 7)).toBe(WON);
    expect(at("AWAY", 60)).toBe(WON);
    expect(at("DRAW", 68)).toBe(WON);
  });

  it("puts a first-half stoppage goal after the 30th and before the 60th minute", () => {
    const f = facts({
      score: { home: 1, away: 0 },
      events: [goal("home", 45, 11, { extraMinute: 2 })],
    });
    expect(at("DRAW", 30, f)).toBe(WON);
    expect(at("HOME", 60, f)).toBe(WON);
  });

  it("an own goal counts for the team the event names", () => {
    const f = facts({
      score: { home: 1, away: 0 },
      events: [goal("home", 10, 21, { detail: "Own Goal" })],
    });
    expect(at("HOME", 15, f)).toBe(WON);
  });

  it("waits while the goals are unknown, needs nothing for a goalless match", () => {
    expect(at("DRAW", 15, facts({ events: null }))).toBeNull();
    expect(
      at("DRAW", 75, facts({ score: { home: 0, away: 0 }, events: null })),
    ).toBe(WON);
    expect(at("TIE", 15)).toBe(VOID);
  });
});

describe("goal scorer", () => {
  const anytime = (pick: string, f = facts()) =>
    resolveGoalScorerBetStatus({ pick, kind: "ANYTIME", facts: f });
  const first = (pick: string, f = facts()) =>
    resolveGoalScorerBetStatus({ pick, kind: "FIRST", facts: f });

  it("anytime: a scorer wins, a player who played and did not score loses", () => {
    expect(anytime("P11")).toBe(WON);
    expect(anytime("P12")).toBe(LOST);
    expect(anytime("P13")).toBe(LOST);
  });

  it("refunds a player who did not take part", () => {
    expect(anytime("P14")).toBe(VOID);
    expect(anytime("P99")).toBe(VOID);
  });

  it("an own goal is not a goal of the scorer", () => {
    const f = facts({
      score: { home: 1, away: 0 },
      events: [goal("home", 10, 21, { detail: "Own Goal" })],
    });
    expect(anytime("P21", f)).toBe(LOST);
    expect(first("NONE", f)).toBe(WON);
  });

  it("a goal settles it even without lineups; a loss needs them", () => {
    const f = facts({ lineups: null });
    expect(anytime("P11", f)).toBe(WON);
    expect(anytime("P12", f)).toBeNull();
  });

  it("a goal without an identified scorer leaves the others unknown", () => {
    const f = facts({
      score: { home: 2, away: 1 },
      events: [
        goal("away", 7, 20),
        goal("home", 68, 11),
        goal("home", 80, null),
      ],
    });
    expect(anytime("P11", f)).toBe(WON);
    expect(anytime("P12", f)).toBeNull();
  });

  it("first: the first goal's scorer wins, the others lose", () => {
    expect(first("P20")).toBe(WON);
    expect(first("P11")).toBe(LOST);
    expect(first("NONE")).toBe(LOST);
  });

  it("first: an own goal first, the next scorer is the first scorer", () => {
    const f = facts({
      score: { home: 1, away: 1 },
      events: [
        goal("away", 3, 12, { detail: "Own Goal" }),
        goal("home", 68, 11),
      ],
    });
    expect(first("P11", f)).toBe(WON);
    expect(first("P12", f)).toBe(LOST);
  });

  it("first: two goals in the same minute keep the API's order", () => {
    const f = facts({
      score: { home: 1, away: 1 },
      events: [goal("home", 7, 11), goal("away", 7, 20)],
    });
    expect(first("P11", f)).toBe(WON);
    expect(first("P20", f)).toBe(LOST);
  });

  it("first: a substitute who came on after the first goal is refunded", () => {
    // 13 came on at 68', after Konsa's 7th-minute goal.
    expect(first("P13")).toBe(VOID);
    const early = facts({
      events: [
        sub("home", 5, 12, 13),
        goal("away", 7, 20),
        goal("home", 68, 11),
      ],
    });
    expect(first("P13", early)).toBe(LOST);
  });

  it("first: a substitute on the pitch without an entry event stays unknown", () => {
    const f = facts({ events: [goal("away", 7, 20), goal("home", 68, 11)] });
    expect(first("P13", f)).toBeNull();
    expect(anytime("P13", f)).toBe(LOST);
  });

  it("first: no goal at all, No Goalscorer wins and every player loses", () => {
    const f = facts({ score: { home: 0, away: 0 }, events: [] });
    expect(first("NONE", f)).toBe(WON);
    expect(first("P11", f)).toBe(LOST);
  });

  it("No Goalscorer is not an anytime pick; an unreadable pick refunds", () => {
    expect(anytime("NONE")).toBe(VOID);
    expect(anytime("11")).toBe(VOID);
  });

  it("waits for the events", () => {
    expect(anytime("P11", facts({ events: null }))).toBeNull();
  });
});

describe("player shots", () => {
  const shots = (pick: string, line: number, onTarget = false, f = facts()) =>
    resolvePlayerShotsBetStatus({ pick, line, onTarget, facts: f });

  it("at least `line`, on a team whose count is complete", () => {
    expect(shots("P11", 2)).toBe(WON);
    expect(shots("P11", 3)).toBe(LOST);
    expect(shots("P13", 1)).toBe(WON);
  });

  it("a null count is none once the team adds up", () => {
    // Home total 4 = 2 + null + 2 + null.
    expect(shots("P12", 1)).toBe(LOST);
    // Home on target 2 = 2 + 0 + null + null.
    expect(shots("P13", 1, true)).toBe(LOST);
  });

  it("a team whose players do not add up stays unknown", () => {
    const f = facts({
      teams: {
        home: { corners: 6, shotsTotal: 9, shotsOn: 2 },
        away: { corners: 3, shotsTotal: 2, shotsOn: 1 },
      },
    });
    expect(shots("P11", 1, false, f)).toBeNull();
    expect(shots("P11", 1, true, f)).toBe(WON);
  });

  it("refunds a player who did not play, waits for unreported statistics", () => {
    expect(shots("P14", 1)).toBe(VOID);
    expect(shots("P99", 1)).toBe(VOID);
    expect(shots("P11", 1, false, facts({ playerStats: null }))).toBeNull();
    expect(shots("P11", 1, false, facts({ playerStats: [] }))).toBeNull();
    const noTeam = facts({
      teams: {
        home: { corners: null, shotsTotal: null, shotsOn: null },
        away: { corners: 3, shotsTotal: 2, shotsOn: 1 },
      },
    });
    expect(shots("P11", 1, false, noTeam)).toBeNull();
  });

  it("refunds a line or pick it cannot read", () => {
    expect(shots("P11", 0)).toBe(VOID);
    expect(shots("P11", 1.5)).toBe(VOID);
    expect(shots("NONE", 1)).toBe(VOID);
  });
});

describe("resolveStatMarketBetStatus", () => {
  it("routes each market and refunds one it does not settle", () => {
    const f = facts();
    expect(
      resolveStatMarketBetStatus({
        market: Market.PLAYER_SHOTS_ON_TARGET,
        pick: "P11",
        line: 2,
        facts: f,
      }),
    ).toBe(WON);
    expect(
      resolveStatMarketBetStatus({
        market: Market.MINUTE_1X2,
        pick: "AWAY",
        line: 30,
        facts: f,
      }),
    ).toBe(WON);
    expect(
      resolveStatMarketBetStatus({
        market: Market.GOAL_SCORER_FIRST,
        pick: "P20",
        line: null,
        facts: f,
      }),
    ).toBe(WON);
    expect(
      resolveStatMarketBetStatus({
        market: Market.ONE_X_TWO,
        pick: "HOME",
        line: null,
        facts: f,
      }),
    ).toBe(VOID);
  });
});
