import { z } from 'zod';

// Schema for API-FOOTBALL GET /coachs?team={id}. Verified live 2026-07-23
// (Real Madrid, id=541): response is an array of coaches associated with
// the queried team, each carrying their FULL managerial career (not just
// the tenure at the queried team) — career[].team.id can reference teams
// outside our tracked set, filtered out at ingestion (coachs-sync.worker.ts).
// career[].team.id can also be null outright (team externalId=88, career
// leg index 2, hit live 2026-07-25) — API-FOOTBALL doesn't always resolve
// the club for old/defunct legs. The worker already drops legs whose id
// doesn't map to a tracked team, so null just takes that same path instead
// of rejecting the coach's entire career (and this team's whole payload).

const CareerEntrySchema = z.object({
  team: z.object({
    id: z.number().int().positive().nullable(),
    name: z.string(),
  }),
  start: z.string().min(1).nullable(),
  end: z.string().nullable(), // null = still in charge as of last sync
});

const CoachItemSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().nullable(),
  career: z.array(CareerEntrySchema),
});

export const ApiFootballCoachsResponseSchema = z.object({
  get: z.literal('coachs'),
  parameters: z.record(z.string(), z.string()),
  errors: z
    .union([z.array(z.unknown()), z.record(z.string(), z.unknown())])
    .optional(),
  results: z.number().int().nonnegative(),
  paging: z
    .object({
      current: z.number().int().positive(),
      total: z.number().int().positive(),
    })
    .optional(),
  response: z.array(CoachItemSchema),
});

export type ApiFootballCoachsResponse = z.infer<
  typeof ApiFootballCoachsResponseSchema
>;
export type ApiFootballCoachItem = z.infer<typeof CoachItemSchema>;
export type ApiFootballCareerEntry = z.infer<typeof CareerEntrySchema>;
