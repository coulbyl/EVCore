import { FixtureEventType } from '@evcore/db';
import type {
  ApiFixtureEvent,
  ApiPlayerStatisticBlock,
  FixtureByIdDetails,
} from '../etl/schemas/fixture-full.schema';
import type {
  FixtureDetailRows,
  FixtureEventRow,
  FixtureLineupRow,
  FixturePlayerStatisticRow,
  PlayerRow,
} from './fixture-events.types';

const EVENT_TYPES: Readonly<Record<string, FixtureEventType>> = {
  Goal: FixtureEventType.GOAL,
  Card: FixtureEventType.CARD,
  subst: FixtureEventType.SUBSTITUTION,
  Var: FixtureEventType.VAR,
};

// DECIMAL(4, 2): a rating past it would fail the whole write.
const MAX_RATING = 99.99;

export class UnknownTeamError extends Error {}

// API-Football writes 0 for a person it does not know.
function identityOf(id: number | null | undefined): number | null {
  return id !== null && id !== undefined && id > 0 ? id : null;
}

/**
 * The rows of one match's events, lineups and player statistics, with the
 * provider team ids mapped to ours. A team that is neither side of the
 * fixture rejects the whole match (same rule as its team statistics); an
 * event of an unknown type, or a player without an id, is left out alone.
 */
export function toFixtureDetailRows(input: {
  details: FixtureByIdDetails;
  teams: ReadonlyMap<number, string>;
}): FixtureDetailRows {
  const { details } = input;
  const teamOf = (externalTeamId: number): string => {
    const teamId = input.teams.get(externalTeamId);
    if (!teamId)
      throw new UnknownTeamError(`Unexpected team ${externalTeamId}`);
    return teamId;
  };

  const events = details.events.flatMap((event, ordinal) =>
    eventRow({ event, ordinal, teamId: teamOf(event.team.id) }),
  );

  const lineups: FixtureLineupRow[] = [];
  const lineupKeys = new Set<string>();
  for (const lineup of details.lineups) {
    const teamId = teamOf(lineup.team.id);
    const sides = [
      { starter: true, players: lineup.startXI },
      { starter: false, players: lineup.substitutes },
    ];
    for (const { starter, players } of sides) {
      for (const { player } of players) {
        const id = identityOf(player.id);
        if (id === null || !player.name) continue;
        const key = `${teamId}:${id}`;
        if (lineupKeys.has(key)) continue;
        lineupKeys.add(key);
        lineups.push({
          teamId,
          playerExternalId: id,
          playerName: player.name,
          number: player.number ?? null,
          position: player.pos ?? null,
          grid: player.grid ?? null,
          starter,
          formation: lineup.formation ?? null,
          coachExternalId: identityOf(lineup.coach?.id),
        });
      }
    }
  }

  const playerStatistics: FixturePlayerStatisticRow[] = [];
  const statKeys = new Set<string>();
  const players = new Map<number, PlayerRow>();
  for (const row of lineups) {
    players.set(row.playerExternalId, {
      externalId: row.playerExternalId,
      name: row.playerName,
      photoUrl: null,
    });
  }
  for (const team of details.players) {
    const teamId = teamOf(team.team.id);
    for (const { player, statistics } of team.players) {
      const id = identityOf(player.id);
      if (id === null) continue;
      // The statistics block names the player in full: it wins over the
      // lineup's spelling. Without a name, the player row waits for one.
      if (player.name) {
        players.set(id, {
          externalId: id,
          name: player.name,
          photoUrl: player.photo ?? null,
        });
      }
      const block = statistics[0];
      if (!block) continue;
      const key = `${teamId}:${id}`;
      if (statKeys.has(key)) continue;
      statKeys.add(key);
      playerStatistics.push(
        playerStatisticRow({ teamId, playerExternalId: id, block }),
      );
    }
  }

  return {
    events,
    lineups,
    playerStatistics,
    players: [...players.values()],
    complete:
      details.events.length > 0 &&
      details.lineups.length > 0 &&
      details.players.length > 0,
  };
}

function eventRow(input: {
  event: ApiFixtureEvent;
  ordinal: number;
  teamId: string;
}): FixtureEventRow[] {
  const { event, ordinal, teamId } = input;
  const type = EVENT_TYPES[event.type];
  if (!type) return [];
  return [
    {
      teamId,
      ordinal,
      minute: event.time.elapsed,
      extraMinute: event.time.extra ?? null,
      type,
      // The column is the API's text: none given, none stored.
      detail: event.detail ?? '',
      comments: event.comments ?? null,
      playerExternalId: identityOf(event.player?.id),
      playerName: event.player?.name ?? null,
      assistExternalId: identityOf(event.assist?.id),
      assistName: event.assist?.name ?? null,
    },
  ];
}

function playerStatisticRow(input: {
  teamId: string;
  playerExternalId: number;
  block: ApiPlayerStatisticBlock;
}): FixturePlayerStatisticRow {
  const { block } = input;
  return {
    teamId: input.teamId,
    playerExternalId: input.playerExternalId,
    minutes: block.games?.minutes ?? null,
    position: block.games?.position ?? null,
    rating: ratingOf(block.games?.rating),
    substitute: block.games?.substitute ?? null,
    shotsTotal: block.shots?.total ?? null,
    shotsOn: block.shots?.on ?? null,
    goals: block.goals?.total ?? null,
    assists: block.goals?.assists ?? null,
    saves: block.goals?.saves ?? null,
    passesTotal: block.passes?.total ?? null,
    passesKey: block.passes?.key ?? null,
    tackles: block.tackles?.total ?? null,
    foulsCommitted: block.fouls?.committed ?? null,
    foulsDrawn: block.fouls?.drawn ?? null,
    yellow: block.cards?.yellow ?? null,
    red: block.cards?.red ?? null,
    offsides: block.offsides ?? null,
    penaltyScored: block.penalty?.scored ?? null,
    penaltyMissed: block.penalty?.missed ?? null,
    raw: block as FixturePlayerStatisticRow['raw'],
  };
}

function ratingOf(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const rating = Number(text);
  return rating <= MAX_RATING ? text : null;
}
