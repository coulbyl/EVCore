import { z } from 'zod';
import { API_FOOTBALL_STATUSES } from './fixture.schema';
import { TeamStatisticsSchema } from './stats.schema';

// Schemas for API-Football GET /fixtures?ids=a-b-c (up to 20 ids): per match
// `fixture`, `league`, `teams`, `goals`, `score`, `events`, `lineups`,
// `statistics`, `players` in one call (measured 03/11: 399/399 finished
// matches had all four arrays).
//
// Validation runs in three layers so one malformed match never rejects the
// other nineteen of its call, and a malformed events block never costs a
// match its team statistics:
// 1. the envelope (`ApiFootballFixturesByIdsResponseSchema`): a failure
//    rejects the whole call, nothing is written;
// 2. per match, its identity and team statistics — the same rule as
//    /fixtures/statistics (exactly two teams);
// 3. per match, its events, lineups and player statistics
//    (`FixtureByIdDetailsSchema`): each event, each team's lineup and each
//    team's player block is validated alone. An invalid one is left out and
//    counted in `dropped` (the workers log it), never the match: a single
//    null the API sends on one event (a VAR check without a detail, 03/11)
//    otherwise cost the match all its scorers, lineups and player
//    statistics. The payload is still validated in full — element by
//    element — and a block missing or not an array rejects the three.
// Many fields come back null (rating, grid, shots, a player's id on a
// cancelled goal), and a person the API does not know has id 0 (measured on
// 15 of 40 matches, 03/11): the schemas accept both, the writers treat
// either as no identity.
//
// Read again on 04/11 against two real answers of 20 ids (20 finished
// matches of 20 championships, 20 not started): no key was ever missing,
// and the nulls the API really sends are, besides those above, a scorer's
// id (Sparta Rotterdam's 85' goal, Eredivisie 01/11), a substitute's id and
// grid, a formation, a coach's photo, the minute, goals and score of a match
// not started (empty arrays for its four blocks), and a team whose
// `statistics` is an empty array. All accepted; the players block's id
// follows the other two blocks (null or 0, no identity).

export const ApiFootballFixturesByIdsResponseSchema = z.object({
  get: z.literal('fixtures'),
  results: z.number().int().nonnegative(),
  response: z.array(z.unknown()),
});

const TeamRefSchema = z.object({ id: z.number().int().positive() });

const nullableGoals = z.number().int().nonnegative().nullish();
const ScoreHalfSchema = z
  .object({ home: nullableGoals, away: nullableGoals })
  .nullish();

// What the settlement and the live minute read of an entry: its state and
// score. Everything a match not started leaves null is nullish (measured
// 04/11: status.elapsed, goals, every score half); the rest of the entry
// (venue, referee, periods, logos) is not read and not validated.
export const FixtureByIdStateSchema = z.object({
  fixture: z.object({
    id: z.number().int().positive(),
    date: z.iso.datetime({ offset: true }),
    status: z.object({
      short: z.preprocess(
        (v) => (typeof v === 'string' ? v.toUpperCase() : v),
        z.enum(API_FOOTBALL_STATUSES),
      ),
      elapsed: z.number().int().nullish(),
    }),
  }),
  goals: z.object({ home: nullableGoals, away: nullableGoals }).nullish(),
  score: z
    .object({ halftime: ScoreHalfSchema, fulltime: ScoreHalfSchema })
    .nullish(),
});

export const FixtureByIdIdentitySchema = z.object({
  fixture: z.object({ id: z.number().int().positive() }),
  teams: z.object({ home: TeamRefSchema, away: TeamRefSchema }),
});

// Same rule as /fixtures/statistics had: exactly two teams.
export const FixtureByIdStatisticsSchema = z
  .array(TeamStatisticsSchema)
  .length(2);

const count = z.number().int().nullish();

const PersonRefSchema = z
  .object({
    id: z.number().int().nonnegative().nullish(),
    name: z.string().nullish(),
  })
  .nullish();

const FixtureEventSchema = z.object({
  time: z.object({
    elapsed: z.number().int(),
    extra: z.number().int().nullish(),
  }),
  team: TeamRefSchema,
  player: PersonRefSchema,
  assist: PersonRefSchema,
  type: z.string(),
  // Null on a VAR check the API has not labelled (Bruno Fernandes' penalty
  // at 58', Manchester United–Roma, 03/11): required, it rejected the whole
  // match's events, lineups and player statistics, and its scorers never
  // showed.
  detail: z.string().nullish(),
  comments: z.string().nullish(),
});

const LineupPlayerSchema = z.object({
  player: z.object({
    id: z.number().int().nonnegative().nullish(),
    name: z.string().nullish(),
    number: count,
    pos: z.string().nullish(),
    grid: z.string().nullish(),
  }),
});

const FixtureLineupSchema = z.object({
  team: TeamRefSchema,
  coach: PersonRefSchema,
  formation: z.string().nullish(),
  startXI: z.array(LineupPlayerSchema),
  substitutes: z.array(LineupPlayerSchema),
});

// Loose: the whole block is kept as `raw`, including fields not read today
// (duels, dribbles, passes accuracy).
const PlayerStatisticBlockSchema = z.looseObject({
  games: z
    .looseObject({
      minutes: count,
      number: count,
      position: z.string().nullish(),
      rating: z.union([z.string(), z.number()]).nullish(),
      captain: z.boolean().nullish(),
      substitute: z.boolean().nullish(),
    })
    .nullish(),
  offsides: count,
  shots: z.looseObject({ total: count, on: count }).nullish(),
  goals: z
    .looseObject({
      total: count,
      conceded: count,
      assists: count,
      saves: count,
    })
    .nullish(),
  passes: z.looseObject({ total: count, key: count }).nullish(),
  tackles: z.looseObject({ total: count }).nullish(),
  fouls: z.looseObject({ drawn: count, committed: count }).nullish(),
  cards: z.looseObject({ yellow: count, red: count }).nullish(),
  penalty: z.looseObject({ scored: count, missed: count }).nullish(),
});

const TeamPlayersSchema = z.object({
  team: TeamRefSchema,
  players: z.array(
    z.object({
      player: z.object({
        // Null in the two other blocks for the same unknown people (04/11):
        // required here, one of them cost his team's whole block.
        id: z.number().int().nonnegative().nullish(),
        name: z.string().nullish(),
        photo: z.string().nullish(),
      }),
      statistics: z.array(PlayerStatisticBlockSchema),
    }),
  ),
});

// An array whose elements are validated one by one: the invalid ones are
// left out and counted, never the array.
function eachValid<T extends z.ZodType>(item: T) {
  return z.array(z.unknown()).transform((elements) => {
    const kept: z.output<T>[] = [];
    let dropped = 0;
    for (const element of elements) {
      const parsed = item.safeParse(element);
      if (parsed.success) kept.push(parsed.data);
      else dropped++;
    }
    return { kept, dropped };
  });
}

export const FixtureByIdDetailsSchema = z
  .object({
    events: eachValid(FixtureEventSchema),
    lineups: eachValid(FixtureLineupSchema),
    players: eachValid(TeamPlayersSchema),
  })
  .transform(({ events, lineups, players }) => ({
    events: events.kept,
    lineups: lineups.kept,
    players: players.kept,
    // Elements left out as invalid, per block.
    dropped: {
      events: events.dropped,
      lineups: lineups.dropped,
      players: players.dropped,
    },
  }));

/** How many events, lineups and player blocks were left out as invalid. */
export function droppedCount(details: FixtureByIdDetails): number {
  const { events, lineups, players } = details.dropped;
  return events + lineups + players;
}

export type FixtureByIdIdentity = z.infer<typeof FixtureByIdIdentitySchema>;
export type FixtureByIdState = z.infer<typeof FixtureByIdStateSchema>;
export type FixtureByIdDetails = z.output<typeof FixtureByIdDetailsSchema>;
export type ApiFixtureEvent = z.infer<typeof FixtureEventSchema>;
export type ApiFixtureLineup = z.infer<typeof FixtureLineupSchema>;
export type ApiTeamPlayers = z.infer<typeof TeamPlayersSchema>;
export type ApiPlayerStatisticBlock = z.infer<
  typeof PlayerStatisticBlockSchema
>;
