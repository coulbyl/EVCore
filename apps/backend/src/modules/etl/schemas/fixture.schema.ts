import { z } from 'zod';

// Raw team shape from football-data.org /v4/competitions/PL/matches
export const FootballDataTeamSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  shortName: z.string().min(1),
});

// Raw match shape from football-data.org
export const FootballDataFixtureSchema = z.object({
  id: z.number().int().positive(),
  utcDate: z.string().datetime({ offset: true }),
  matchday: z.number().int().positive(),
  status: z.enum([
    'SCHEDULED',
    'FINISHED',
    'POSTPONED',
    'CANCELLED',
    'IN_PLAY',
    'PAUSED',
    'SUSPENDED',
    'AWARDED',
  ]),
  homeTeam: FootballDataTeamSchema,
  awayTeam: FootballDataTeamSchema,
  score: z.object({
    fullTime: z.object({
      home: z.number().int().nonnegative().nullable(),
      away: z.number().int().nonnegative().nullable(),
    }),
  }),
});

// Top-level response from football-data.org
export const FootballDataResponseSchema = z.object({
  competition: z.object({ code: z.string().min(1) }),
  season: z.object({
    startDate: z.string().datetime({ offset: true }).nullable(),
    endDate: z.string().datetime({ offset: true }).nullable(),
  }),
  matches: z.array(FootballDataFixtureSchema),
});

export type FootballDataTeam = z.infer<typeof FootballDataTeamSchema>;
export type FootballDataFixture = z.infer<typeof FootballDataFixtureSchema>;
export type FootballDataResponse = z.infer<typeof FootballDataResponseSchema>;
