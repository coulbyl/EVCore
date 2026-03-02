import { z } from 'zod';

// The API-Football /odds endpoint returns all available bet types per bookmaker.
// We accept any bet type at the schema level and filter for Match Winner in the worker.
const BetValueSchema = z.object({
  value: z.string().min(1),
  odd: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .transform(Number)
    .refine((v) => v > 1 && v < 1000, {
      message: 'odd must be in sensible decimal range (1, 1000)',
    }),
});

const AnyBetSchema = z.object({
  id: z.number(),
  name: z.string(),
  values: z.array(BetValueSchema),
});

const BookmakerSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  bets: z.array(AnyBetSchema),
});

const OddsMatchSchema = z.object({
  fixture: z.object({ id: z.number().int().positive() }),
  // ISO datetime with offset: "2026-03-01T16:30:20+00:00"
  update: z.iso.datetime({ offset: true }),
  bookmakers: z.array(BookmakerSchema),
});

export const ApiFootballOddsResponseSchema = z.object({
  response: z.array(OddsMatchSchema),
});

export type ApiFootballOddsResponse = z.infer<
  typeof ApiFootballOddsResponseSchema
>;
export type OddsMatch = z.infer<typeof OddsMatchSchema>;
export type OddsBookmaker = z.infer<typeof BookmakerSchema>;
