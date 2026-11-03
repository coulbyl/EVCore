import { z } from 'zod';

// A team's final statistics, as API-Football writes them in the
// `statistics` block of /fixtures?ids= (fixture-full.schema.ts) — the same
// shape /fixtures/statistics?fixture={id} returned before 03/11.

const StatisticEntrySchema = z.object({
  type: z.string(),
  // Value can be a number, a string (e.g. "72%" for possession), or null when unavailable
  value: z.union([z.number(), z.string(), z.null()]),
});

export const TeamStatisticsSchema = z.object({
  team: z.object({
    id: z.number().int().positive(),
    name: z.string(),
  }),
  statistics: z.array(StatisticEntrySchema),
});

export type TeamStatistics = z.infer<typeof TeamStatisticsSchema>;
