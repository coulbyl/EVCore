import { z } from 'zod';

// Schema for API-FOOTBALL GET /injuries?fixture={id}
// Endpoint can return 0..N rows (one per injured player).

const InjuryItemSchema = z.object({
  team: z.object({
    id: z.number().int().positive(),
    name: z.string(),
  }),
  player: z.object({
    id: z.number().int().positive().nullable().optional(),
    name: z.string().min(1).nullable(),
    type: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
  }),
  fixture: z.object({
    id: z.number().int().positive(),
  }),
});

export const ApiFootballInjuriesResponseSchema = z.object({
  get: z.literal('injuries'),
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
  response: z.array(InjuryItemSchema),
});

export type ApiFootballInjuriesResponse = z.infer<
  typeof ApiFootballInjuriesResponseSchema
>;
export type ApiFootballInjuryItem = z.infer<typeof InjuryItemSchema>;
