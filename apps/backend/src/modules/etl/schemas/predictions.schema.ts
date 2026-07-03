import { z } from 'zod';

// Schema for API-FOOTBALL GET /predictions?fixture={id}
// Reference: https://www.api-football.com/documentation-v3#tag/Predictions
// Only the fields consumed by the shadow cross-check are validated — the
// endpoint returns much more (h2h, team form, league stats) that we ignore.

// Percentages come as strings like "50%" or "74.0%".
const PercentStringSchema = z
  .string()
  .regex(/^\d+(\.\d+)?\s*%$/)
  .transform((value) => Number.parseFloat(value));

export const ApiFootballPredictionsResponseSchema = z.object({
  response: z.array(
    z.object({
      predictions: z.object({
        winner: z.object({ name: z.string() }).nullable(),
        percent: z.object({
          home: PercentStringSchema,
          draw: PercentStringSchema,
          away: PercentStringSchema,
        }),
      }),
      comparison: z.object({
        poisson_distribution: z.object({
          home: PercentStringSchema,
          away: PercentStringSchema,
        }),
        total: z
          .object({
            home: PercentStringSchema,
            away: PercentStringSchema,
          })
          .optional(),
      }),
    }),
  ),
});

export type ApiFootballPredictionsResponse = z.infer<
  typeof ApiFootballPredictionsResponseSchema
>;
