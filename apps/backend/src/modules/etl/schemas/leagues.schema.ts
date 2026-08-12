import { z } from 'zod';

// Schema for API-FOOTBALL GET /leagues?id={id}. Verified live 2026-08-13
// (J1 League, id=98): each season entry carries its own `start`/`end` dates
// and a `current` flag — this is the authoritative source for season date
// ranges, used instead of locally guessing them from `seasonStartMonth`
// (season-window.utils.ts). Guessing breaks whenever a competition's
// `year` label doesn't equal its real start year, which happens on format
// transitions (J1 switched from a calendar-year season to a split-year one
// starting 2026-27; API-FOOTBALL labels that season `2027` even though it
// starts in August 2026) or during long off-season gaps where API-FOOTBALL
// flips `current` to next season before the local month-based heuristic does
// (seen on AUS1). Only `year`/`start`/`end`/`current` are consumed — the
// `coverage` block is ignored.

const LeagueSeasonSchema = z.object({
  year: z.number().int().positive(),
  start: z.string().min(1),
  end: z.string().min(1),
  current: z.boolean(),
});

const LeagueItemSchema = z.object({
  league: z.object({
    id: z.number().int().positive(),
    name: z.string(),
  }),
  seasons: z.array(LeagueSeasonSchema),
});

export const ApiFootballLeaguesResponseSchema = z.object({
  get: z.literal('leagues'),
  parameters: z.record(z.string(), z.string()),
  errors: z
    .union([z.array(z.unknown()), z.record(z.string(), z.unknown())])
    .optional(),
  results: z.number().int().nonnegative(),
  response: z.array(LeagueItemSchema),
});

export type ApiFootballLeaguesResponse = z.infer<
  typeof ApiFootballLeaguesResponseSchema
>;
export type ApiFootballLeagueSeason = z.infer<typeof LeagueSeasonSchema>;
