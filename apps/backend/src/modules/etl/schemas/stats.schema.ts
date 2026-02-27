import { z } from 'zod';

// Raw team stats scraped from FBref — validated before any DB write
export const TeamStatsRawSchema = z.object({
  teamName: z.string().min(1),
  homeWins: z.number().int().nonnegative(),
  homeDraws: z.number().int().nonnegative(),
  homeLosses: z.number().int().nonnegative(),
  awayWins: z.number().int().nonnegative(),
  awayDraws: z.number().int().nonnegative(),
  awayLosses: z.number().int().nonnegative(),
});

export const SeasonStatsSchema = z.array(TeamStatsRawSchema);

export type TeamStatsRaw = z.infer<typeof TeamStatsRawSchema>;
