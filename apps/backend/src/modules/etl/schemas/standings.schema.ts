import { z } from 'zod';

// Schema for API-FOOTBALL GET /standings?league={id}&season={year}
// Reference: https://www.api-football.com/documentation-v3#tag/Standings

const StandingTeamSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  logo: z.string(),
});

const StandingGoalsSchema = z.object({
  for: z.number().int().nonnegative().nullable().default(0),
  against: z.number().int().nonnegative().nullable().default(0),
});

const StandingAllSchema = z.object({
  played: z.number().int().nonnegative(),
  win: z.number().int().nonnegative(),
  draw: z.number().int().nonnegative(),
  lose: z.number().int().nonnegative(),
  goals: StandingGoalsSchema,
});

const StandingEntrySchema = z.object({
  rank: z.number().int().positive(),
  team: StandingTeamSchema,
  points: z.number().int().nonnegative(),
  goalsDiff: z.number().int(),
  group: z.string(),
  form: z.string().nullable(),
  description: z.string().nullable(),
  all: StandingAllSchema,
});

const LeagueStandingsSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  season: z.number().int(),
  standings: z.array(z.array(StandingEntrySchema)),
});

export const ApiFootballStandingsResponseSchema = z.object({
  get: z.literal('standings'),
  results: z.number().int().nonnegative(),
  response: z.array(
    z.object({
      league: LeagueStandingsSchema,
    }),
  ),
});

export type StandingEntry = z.infer<typeof StandingEntrySchema>;
export type ApiFootballStandingsResponse = z.infer<
  typeof ApiFootballStandingsResponseSchema
>;
