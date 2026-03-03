import { z } from 'zod';

// Validated shape for updating a fixture's final result
export const ResultSchema = z.object({
  externalId: z.number().int().positive(),
  homeScore: z.number().int().nonnegative(),
  awayScore: z.number().int().nonnegative(),
  homeHtScore: z.number().int().nonnegative().nullable(),
  awayHtScore: z.number().int().nonnegative().nullable(),
  status: z.literal('FINISHED'),
});

export type Result = z.infer<typeof ResultSchema>;
