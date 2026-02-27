import { z } from 'zod';

// Validated shape for updating a fixture's final result
export const ResultSchema = z.object({
  externalId: z.number().int().positive(),
  homeScore: z.number().int().nonnegative(),
  awayScore: z.number().int().nonnegative(),
  status: z.literal('FINISHED'),
});

export type Result = z.infer<typeof ResultSchema>;
