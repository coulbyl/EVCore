import { z } from 'zod';

// ─── API-FOOTBALL /fixtures response schema ───────────────────────────────────
// Validated against live EPL data (season 2022, confirmed 2026-02-27).

export const API_FOOTBALL_STATUSES = [
  'TBD',
  'NS',
  '1H',
  'HT',
  '2H',
  'ET',
  'BT',
  'P',
  'INT',
  'SUSP',
  'FT',
  'AET',
  'PEN',
  'PST',
  'CANC',
  'ABD',
  'AWD',
] as const;

export type ApiFootballStatus = (typeof API_FOOTBALL_STATUSES)[number];

const ScoreHalfSchema = z.object({
  home: z.number().int().nonnegative().nullable(),
  away: z.number().int().nonnegative().nullable(),
});

const VenueSchema = z.object({
  id: z.number().int().nullable(),
  name: z.string().nullable(),
  city: z.string().nullable(),
});

export const ApiFootballTeamSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  logo: z.string(),
  winner: z.boolean().nullable(),
});

export const ApiFootballFixtureSchema = z.object({
  fixture: z.object({
    id: z.number().int().positive(),
    referee: z.string().nullable(),
    timezone: z.string(),
    date: z.string().datetime({ offset: true }),
    timestamp: z.number().int(),
    periods: z.object({
      first: z.number().int().nullable(),
      second: z.number().int().nullable(),
    }),
    venue: VenueSchema,
    status: z.object({
      long: z.string(),
      short: z.enum(API_FOOTBALL_STATUSES),
      elapsed: z.number().int().nullable(),
      extra: z.number().int().nullable().optional(),
    }),
  }),
  league: z.object({
    id: z.number().int().positive(),
    name: z.string(),
    country: z.string(),
    logo: z.string(),
    flag: z.string().nullable(),
    season: z.number().int(),
    // e.g. "Regular Season - 24" — matchday parsed from this string
    round: z.string(),
    standings: z.boolean().optional(),
  }),
  teams: z.object({
    home: ApiFootballTeamSchema,
    away: ApiFootballTeamSchema,
  }),
  goals: z.object({
    home: z.number().int().nonnegative().nullable(),
    away: z.number().int().nonnegative().nullable(),
  }),
  score: z.object({
    halftime: ScoreHalfSchema,
    fulltime: ScoreHalfSchema,
    extratime: ScoreHalfSchema,
    penalty: ScoreHalfSchema,
  }),
});

export const ApiFootballFixturesResponseSchema = z.object({
  get: z.literal('fixtures'),
  parameters: z.record(z.string(), z.string()),
  errors: z.array(z.unknown()),
  results: z.number().int().nonnegative(),
  paging: z.object({
    current: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  }),
  response: z.array(ApiFootballFixtureSchema),
});

export type ApiFootballFixture = z.infer<typeof ApiFootballFixtureSchema>;
export type ApiFootballFixturesResponse = z.infer<
  typeof ApiFootballFixturesResponseSchema
>;
