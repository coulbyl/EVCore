import { z } from 'zod';
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
// 3. per match, its events, lineups and player statistics together
//    (`FixtureByIdDetailsSchema`): a failure rejects the three, never part
//    of them.
// Many fields come back null (rating, grid, shots, a player's id on a
// cancelled goal), and a person the API does not know has id 0 (measured on
// 15 of 40 matches, 03/11): the schemas accept both, the writers treat
// either as no identity.

export const ApiFootballFixturesByIdsResponseSchema = z.object({
  get: z.literal('fixtures'),
  results: z.number().int().nonnegative(),
  response: z.array(z.unknown()),
});

const TeamRefSchema = z.object({ id: z.number().int().positive() });

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
  detail: z.string(),
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
        id: z.number().int().nonnegative(),
        name: z.string().nullish(),
        photo: z.string().nullish(),
      }),
      statistics: z.array(PlayerStatisticBlockSchema),
    }),
  ),
});

export const FixtureByIdDetailsSchema = z.object({
  events: z.array(FixtureEventSchema),
  lineups: z.array(FixtureLineupSchema),
  players: z.array(TeamPlayersSchema),
});

export type FixtureByIdIdentity = z.infer<typeof FixtureByIdIdentitySchema>;
export type FixtureByIdDetails = z.infer<typeof FixtureByIdDetailsSchema>;
export type ApiFixtureEvent = z.infer<typeof FixtureEventSchema>;
export type ApiFixtureLineup = z.infer<typeof FixtureLineupSchema>;
export type ApiTeamPlayers = z.infer<typeof TeamPlayersSchema>;
export type ApiPlayerStatisticBlock = z.infer<
  typeof PlayerStatisticBlockSchema
>;
