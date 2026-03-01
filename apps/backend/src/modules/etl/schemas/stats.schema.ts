import { z } from 'zod';

// Schema for API-FOOTBALL GET /fixtures/statistics?fixture={id}
// Reference: https://www.api-football.com/documentation-v3#tag/Fixtures/operation/get-fixtures-statistics
// Returns exactly 2 team objects (home then away) — ordered as listed in the fixture.

const StatisticEntrySchema = z.object({
  type: z.string(),
  // Value can be a number, a string (e.g. "72%" for possession), or null when unavailable
  value: z.union([z.number(), z.string(), z.null()]),
});

const TeamStatisticsSchema = z.object({
  team: z.object({
    id: z.number().int().positive(),
    name: z.string(),
  }),
  statistics: z.array(StatisticEntrySchema),
});

export const ApiFootballStatisticsResponseSchema = z.object({
  get: z.literal('fixtures/statistics'),
  parameters: z.record(z.string(), z.string()),
  results: z.number().int().nonnegative(),
  // API always returns exactly 2 team objects (home then away) for a played fixture
  response: z.array(TeamStatisticsSchema).length(2),
});

export type TeamStatistics = z.infer<typeof TeamStatisticsSchema>;
export type ApiFootballStatisticsResponse = z.infer<
  typeof ApiFootballStatisticsResponseSchema
>;
