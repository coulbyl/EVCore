// Settlement of the markets of phase 3 of the strategies plan (03/11):
// team corners, corners 1X2, scorers, player shots, 1X2 at a given minute.
//
// Every resolver answers WON, LOST, VOID (the book refunds: the player did
// not play, a line met exactly) or null — not known yet. Null is never a
// loss: the caller waits, then refunds after its grace period. The match
// facts come from the match statistics, events, lineups and player
// statistics (API-Football /fixtures?ids=); a fact that was not reported is
// null, never zero.

import { BetStatus, Market } from "../types";
import { NO_GOALSCORER_PICK, playerIdOfPick } from "../players/name-matching";
import { resolveCornersBetStatus } from "./bet-settlement";

export type MatchSide = "home" | "away";

/** One event of the match, its team resolved to a side (null: neither). */
export type MatchEventFact = {
  side: MatchSide | null;
  ordinal: number;
  minute: number;
  extraMinute: number | null;
  type: "GOAL" | "CARD" | "SUBSTITUTION" | "VAR";
  /** The API's text: Normal Goal, Penalty, Own Goal, Missed Penalty, … */
  detail: string;
  comments: string | null;
  /** Scorer (goal) or player going off (substitution). */
  playerExternalId: number | null;
  playerName: string | null;
  /** Assist (goal) or player coming on (substitution). */
  assistExternalId: number | null;
};

export type LineupFact = {
  side: MatchSide;
  playerExternalId: number;
  starter: boolean;
};

/** A null count is unknown (the API leaves many at null). */
export type PlayerStatFact = {
  side: MatchSide;
  playerExternalId: number;
  minutes: number | null;
  shotsTotal: number | null;
  shotsOn: number | null;
};

/** A team's match statistics; null when not reported. */
export type TeamStatFact = {
  corners: number | null;
  shotsTotal: number | null;
  shotsOn: number | null;
};

export type MatchFacts = {
  /** Full-time score (90 minutes and stoppage time); null until finished. */
  score: { home: number; away: number } | null;
  teams: Record<MatchSide, TeamStatFact>;
  /** Null until the events were reported. */
  events: readonly MatchEventFact[] | null;
  /** Null (or empty) until the lineups were reported. */
  lineups: readonly LineupFact[] | null;
  /** Null (or empty) until the player statistics were reported. */
  playerStats: readonly PlayerStatFact[] | null;
};

/** A goal of the score: the side it counts for, when, who. */
export type ScoreGoal = {
  side: MatchSide;
  minute: number;
  extraMinute: number | null;
  ordinal: number;
  ownGoal: boolean;
  scorerExternalId: number | null;
};

const SCORE_GOALS = new Set(["Normal Goal", "Penalty", "Own Goal"]);
const SHOOTOUT = "Penalty Shootout";
// The score is the full-time one: extra time (91' to 120') is not in it.
const LAST_REGULATION_MINUTE = 90;

const byTime = (
  a: { minute: number; extraMinute: number | null; ordinal: number },
  b: { minute: number; extraMinute: number | null; ordinal: number },
): number =>
  a.minute - b.minute ||
  (a.extraMinute ?? 0) - (b.extraMinute ?? 0) ||
  a.ordinal - b.ordinal;

/**
 * The goals that make the full-time score, in order; null when they cannot
 * be known: events not reported, or the goals left do not make the score
 * (a goal missing, one the VAR took back still listed). Same rules as the
 * match sheet: a goal without a scorer's name is the trace of a cancelled
 * one, shoot-out kicks and extra time are not in the score, an own goal's
 * event names the team it counts for. A goalless score needs no event.
 */
export function scoreGoals(facts: MatchFacts): ScoreGoal[] | null {
  const { score, events } = facts;
  if (score === null) return null;
  if (score.home === 0 && score.away === 0) return [];
  if (events === null) return null;

  const goals: ScoreGoal[] = [];
  for (const event of [...events].sort(byTime)) {
    if (event.type !== "GOAL" || event.side === null) continue;
    if (event.comments === SHOOTOUT) continue;
    if (event.minute > LAST_REGULATION_MINUTE) continue;
    if (!SCORE_GOALS.has(event.detail) || event.playerName === null) continue;
    goals.push({
      side: event.side,
      minute: event.minute,
      extraMinute: event.extraMinute,
      ordinal: event.ordinal,
      ownGoal: event.detail === "Own Goal",
      scorerExternalId: event.playerExternalId,
    });
  }
  const count = (side: MatchSide) =>
    goals.filter((goal) => goal.side === side).length;
  return count("home") === score.home && count("away") === score.away
    ? goals
    : null;
}

/** Corners of one team over or under a line; a met integer line refunds. */
export function resolveTeamCornersBetStatus(
  pick: string,
  line: number,
  corners: number | null,
): BetStatus | null {
  return resolveCornersBetStatus(pick, line, corners);
}

/** Which team takes more corners; level is DRAW. */
export function resolveCorners1x2BetStatus(
  pick: string,
  home: number | null,
  away: number | null,
): BetStatus | null {
  if (home === null || away === null) return null;
  const outcome = home > away ? "HOME" : home < away ? "AWAY" : "DRAW";
  if (pick !== "HOME" && pick !== "DRAW" && pick !== "AWAY") {
    return BetStatus.VOID;
  }
  return pick === outcome ? BetStatus.WON : BetStatus.LOST;
}

/**
 * Result at minute `minute` (`line` of MINUTE_1X2): the goals of the
 * score whose minute is at most `minute`. API minutes count the minute
 * being played (a goal at 14:30 is the 15th), so « 1X2 at 15 minutes »
 * (0:00–14:59) holds the goals of minutes 1 to 15. A first-half stoppage
 * goal (45+2) belongs to the 45th minute: in the 60-minute result, not the
 * 30-minute one.
 */
export function resolveMinute1x2BetStatus(input: {
  pick: string;
  minute: number;
  facts: MatchFacts;
}): BetStatus | null {
  const { pick, minute } = input;
  if (pick !== "HOME" && pick !== "DRAW" && pick !== "AWAY") {
    return BetStatus.VOID;
  }
  const goals = scoreGoals(input.facts);
  if (goals === null) return null;
  const by = (side: MatchSide) =>
    goals.filter((goal) => goal.side === side && goal.minute <= minute).length;
  const home = by("home");
  const away = by("away");
  const outcome = home > away ? "HOME" : home < away ? "AWAY" : "DRAW";
  return pick === outcome ? BetStatus.WON : BetStatus.LOST;
}

type Participation =
  | { played: false }
  | { played: true; enteredAt: ScoreGoalTime | null }
  | null;

type ScoreGoalTime = {
  minute: number;
  extraMinute: number | null;
  ordinal: number;
};

/**
 * Did the player take part, and since when: a starter from the kick-off, a
 * substitute from the event that brought him on. Null when the lineups were
 * not reported; not in either lineup = did not play. A substitute the
 * statistics show on the pitch without a substitution event entered at an
 * unknown time.
 */
function participation(facts: MatchFacts, playerId: number): Participation {
  if (facts.lineups === null || facts.lineups.length === 0) return null;
  const listed = facts.lineups.find((row) => row.playerExternalId === playerId);
  if (!listed) return { played: false };
  if (listed.starter) {
    return {
      played: true,
      enteredAt: { minute: 0, extraMinute: null, ordinal: -1 },
    };
  }
  const entry = (facts.events ?? [])
    .filter(
      (event) =>
        event.type === "SUBSTITUTION" && event.assistExternalId === playerId,
    )
    .sort(byTime)[0];
  if (entry) {
    return {
      played: true,
      enteredAt: {
        minute: entry.minute,
        extraMinute: entry.extraMinute,
        ordinal: entry.ordinal,
      },
    };
  }
  // No entry event: the statistics decide (minutes on the pitch), when
  // they were reported.
  if (facts.playerStats === null || facts.playerStats.length === 0) {
    return null;
  }
  const stats = facts.playerStats.find(
    (row) => row.playerExternalId === playerId,
  );
  return stats && (stats.minutes ?? 0) > 0
    ? { played: true, enteredAt: null }
    : { played: false };
}

/**
 * Anytime and first goal scorer, as Bet365 settles them: own goals do not
 * count; a player who did not take part is refunded; at first scorer, a
 * substitute who came on after the first goal is refunded, and « No
 * Goalscorer » (NONE) wins when no goal but own goals was scored.
 */
export function resolveGoalScorerBetStatus(input: {
  pick: string;
  kind: "ANYTIME" | "FIRST";
  facts: MatchFacts;
}): BetStatus | null {
  const { pick, kind, facts } = input;
  const goals = scoreGoals(facts);
  if (goals === null) return null;
  const scored = goals.filter((goal) => !goal.ownGoal);

  if (pick === NO_GOALSCORER_PICK) {
    if (kind !== "FIRST") return BetStatus.VOID;
    return scored.length === 0 ? BetStatus.WON : BetStatus.LOST;
  }
  const playerId = playerIdOfPick(pick);
  if (playerId === null) return BetStatus.VOID;

  // A goal of his settles it whatever the lineups say: he was on the pitch.
  const [first] = scored;
  if (kind === "ANYTIME") {
    if (scored.some((goal) => goal.scorerExternalId === playerId)) {
      return BetStatus.WON;
    }
  } else if (first !== undefined && first.scorerExternalId === playerId) {
    return BetStatus.WON;
  }

  const took = participation(facts, playerId);
  if (took === null) return null;
  if (!took.played) return BetStatus.VOID;

  if (kind === "ANYTIME") {
    // A goal whose scorer the API did not identify could be his.
    return scored.some((goal) => goal.scorerExternalId === null)
      ? null
      : BetStatus.LOST;
  }
  if (first === undefined) return BetStatus.LOST;
  if (first.scorerExternalId === null) return null;
  if (took.enteredAt === null) return null;
  return byTime(took.enteredAt, first) > 0 ? BetStatus.VOID : BetStatus.LOST;
}

/**
 * At least `line` shots (or shots on target) for the player. Settled only
 * when the team's count is complete: its players' counts (null read as
 * none) add up to the team's own statistic. Measured on 399 matches of
 * 03/11: shots on target add up in 797 of 798 teams, total shots in 424 —
 * the per-player totals leave shots out, so an incomplete team stays
 * unknown rather than graded on a lower bound. A player who did not play is
 * refunded.
 */
export function resolvePlayerShotsBetStatus(input: {
  pick: string;
  line: number;
  onTarget: boolean;
  facts: MatchFacts;
}): BetStatus | null {
  const { line, onTarget, facts } = input;
  const playerId = playerIdOfPick(input.pick);
  if (playerId === null || !Number.isInteger(line) || line < 1) {
    return BetStatus.VOID;
  }
  const stats = facts.playerStats;
  if (stats === null || stats.length === 0) return null;
  const row = stats.find((entry) => entry.playerExternalId === playerId);
  if (!row || (row.minutes ?? 0) <= 0) {
    // Statistics reported: a player missing or without minutes did not play.
    return BetStatus.VOID;
  }

  const count = (entry: PlayerStatFact) =>
    (onTarget ? entry.shotsOn : entry.shotsTotal) ?? 0;
  const team = facts.teams[row.side];
  const teamCount = onTarget ? team.shotsOn : team.shotsTotal;
  if (teamCount === null) return null;
  const sum = stats
    .filter((entry) => entry.side === row.side)
    .reduce((total, entry) => total + count(entry), 0);
  if (sum !== teamCount) return null;
  return count(row) >= line ? BetStatus.WON : BetStatus.LOST;
}

/** The eight markets these resolvers settle. */
export const STAT_SETTLED_MARKETS: ReadonlySet<Market> = new Set<Market>([
  Market.CORNERS_HOME,
  Market.CORNERS_AWAY,
  Market.CORNERS_1X2,
  Market.GOAL_SCORER_ANYTIME,
  Market.GOAL_SCORER_FIRST,
  Market.PLAYER_SHOTS,
  Market.PLAYER_SHOTS_ON_TARGET,
  Market.MINUTE_1X2,
]);

/**
 * One leg of a phase 3 market against the match facts; null = not known
 * yet. A market outside STAT_SETTLED_MARKETS, or a line its market needs
 * and does not have, is refunded.
 */
export function resolveStatMarketBetStatus(input: {
  market: Market;
  pick: string;
  line: number | null;
  facts: MatchFacts;
}): BetStatus | null {
  const { market, pick, line, facts } = input;
  switch (market) {
    case Market.CORNERS_HOME:
      return line === null
        ? BetStatus.VOID
        : resolveTeamCornersBetStatus(pick, line, facts.teams.home.corners);
    case Market.CORNERS_AWAY:
      return line === null
        ? BetStatus.VOID
        : resolveTeamCornersBetStatus(pick, line, facts.teams.away.corners);
    case Market.CORNERS_1X2:
      return resolveCorners1x2BetStatus(
        pick,
        facts.teams.home.corners,
        facts.teams.away.corners,
      );
    case Market.GOAL_SCORER_ANYTIME:
      return resolveGoalScorerBetStatus({ pick, kind: "ANYTIME", facts });
    case Market.GOAL_SCORER_FIRST:
      return resolveGoalScorerBetStatus({ pick, kind: "FIRST", facts });
    case Market.PLAYER_SHOTS:
    case Market.PLAYER_SHOTS_ON_TARGET:
      return line === null
        ? BetStatus.VOID
        : resolvePlayerShotsBetStatus({
            pick,
            line,
            onTarget: market === Market.PLAYER_SHOTS_ON_TARGET,
            facts,
          });
    case Market.MINUTE_1X2:
      return line === null || !Number.isInteger(line)
        ? BetStatus.VOID
        : resolveMinute1x2BetStatus({ pick, minute: line, facts });
    default:
      return BetStatus.VOID;
  }
}
