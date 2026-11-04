import type {
  MatchEventFact,
  MatchFacts,
  MatchSide,
  TeamStatFact,
} from "./stat-markets";

/** fixture_statistic types the phase 3 markets settle on. */
export const MATCH_FACT_STAT_TYPES = {
  corners: "corner_kicks",
  shotsTotal: "total_shots",
  shotsOn: "shots_on_goal",
  yellowCards: "yellow_cards",
  redCards: "red_cards",
} as const;

type TeamRow = { teamId: string };

/** The stored rows of one match, as the settlement and the studies read them. */
export type MatchFactsRows = {
  finished: boolean;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  /** `fixture.eventsSyncedAt` set: no event row then means none. */
  eventsReported: boolean;
  statistics: ReadonlyArray<TeamRow & { type: string; value: number }>;
  events: ReadonlyArray<TeamRow & Omit<MatchEventFact, "side">>;
  lineups: ReadonlyArray<
    TeamRow & { playerExternalId: number; starter: boolean }
  >;
  playerStatistics: ReadonlyArray<
    TeamRow & {
      playerExternalId: number;
      minutes: number | null;
      shotsTotal: number | null;
      shotsOn: number | null;
    }
  >;
};

/**
 * The facts of a match from its stored rows. The score only once the match
 * is finished; events, lineups and player statistics null until reported —
 * events count as reported once synced, even with no row (a match without a
 * goal nor a card). A row of a team that is neither side is dropped.
 */
export function buildMatchFacts(rows: MatchFactsRows): MatchFacts {
  const sideOf = (teamId: string): MatchSide | null =>
    teamId === rows.homeTeamId
      ? "home"
      : teamId === rows.awayTeamId
        ? "away"
        : null;
  const team = (teamId: string): TeamStatFact => {
    const value = (type: string): number | null =>
      rows.statistics.find(
        (entry) => entry.teamId === teamId && entry.type === type,
      )?.value ?? null;
    const yellowCards = value(MATCH_FACT_STAT_TYPES.yellowCards);
    return {
      corners: value(MATCH_FACT_STAT_TYPES.corners),
      shotsTotal: value(MATCH_FACT_STAT_TYPES.shotsTotal),
      shotsOn: value(MATCH_FACT_STAT_TYPES.shotsOn),
      yellowCards,
      // The API leaves the red cards it has none of at null, and the row is
      // then not written: 68 992 team-matches have their yellows and no red
      // row, and the 8 of them the stored events cover (03–04/11) had
      // no red card. With the yellows reported, no red row is none; without them,
      // the team's cards are unknown.
      redCards:
        value(MATCH_FACT_STAT_TYPES.redCards) ??
        (yellowCards === null ? null : 0),
    };
  };
  const sided = <T extends TeamRow>(list: readonly T[]) =>
    list.flatMap((entry) => {
      const side = sideOf(entry.teamId);
      return side === null ? [] : [{ entry, side }];
    });

  return {
    score:
      rows.finished && rows.homeScore !== null && rows.awayScore !== null
        ? { home: rows.homeScore, away: rows.awayScore }
        : null,
    teams: { home: team(rows.homeTeamId), away: team(rows.awayTeamId) },
    events:
      rows.events.length === 0 && !rows.eventsReported
        ? null
        : rows.events.map(({ teamId, ...event }) => ({
            ...event,
            side: sideOf(teamId),
          })),
    lineups:
      rows.lineups.length === 0
        ? null
        : sided(rows.lineups).map(({ entry, side }) => ({
            side,
            playerExternalId: entry.playerExternalId,
            starter: entry.starter,
          })),
    playerStats:
      rows.playerStatistics.length === 0
        ? null
        : sided(rows.playerStatistics).map(({ entry, side }) => ({
            side,
            playerExternalId: entry.playerExternalId,
            minutes: entry.minutes,
            shotsTotal: entry.shotsTotal,
            shotsOn: entry.shotsOn,
          })),
  };
}
