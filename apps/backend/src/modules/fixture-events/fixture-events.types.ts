import type { FixtureEventType, Prisma } from '@evcore/db';

export type FixtureEventRow = {
  teamId: string;
  ordinal: number;
  minute: number;
  extraMinute: number | null;
  type: FixtureEventType;
  detail: string;
  comments: string | null;
  playerExternalId: number | null;
  playerName: string | null;
  assistExternalId: number | null;
  assistName: string | null;
};

export type FixtureLineupRow = {
  teamId: string;
  playerExternalId: number;
  playerName: string;
  number: number | null;
  position: string | null;
  grid: string | null;
  starter: boolean;
  formation: string | null;
  coachExternalId: number | null;
};

/** A null count is unknown, never zero. */
export type FixturePlayerStatisticRow = {
  teamId: string;
  playerExternalId: number;
  minutes: number | null;
  position: string | null;
  /** As the API wrote it ("7.2"); a Decimal at the Prisma boundary. */
  rating: string | null;
  substitute: boolean | null;
  shotsTotal: number | null;
  shotsOn: number | null;
  goals: number | null;
  assists: number | null;
  saves: number | null;
  passesTotal: number | null;
  passesKey: number | null;
  tackles: number | null;
  foulsCommitted: number | null;
  foulsDrawn: number | null;
  yellow: number | null;
  red: number | null;
  offsides: number | null;
  penaltyScored: number | null;
  penaltyMissed: number | null;
  raw: Prisma.InputJsonObject;
};

export type PlayerRow = {
  externalId: number;
  name: string;
  photoUrl: string | null;
};

export type FixtureDetailRows = {
  events: FixtureEventRow[];
  lineups: FixtureLineupRow[];
  playerStatistics: FixturePlayerStatisticRow[];
  players: PlayerRow[];
  /**
   * The API returned events, lineups and player statistics: nothing more
   * is expected for this match.
   */
  complete: boolean;
};

export type FixtureDetailWriteResult =
  | {
      status: 'written';
      events: number;
      lineups: number;
      playerStatistics: number;
      /** fixture.eventsSyncedAt set: nothing left to fetch. */
      synced: boolean;
    }
  | { status: 'rejected'; reason: string };
