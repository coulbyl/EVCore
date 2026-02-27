import { z } from 'zod';

const OddsValueSchema = z.object({
  value: z.enum(['Home', 'Draw', 'Away']),
  odd: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .transform(Number)
    .refine((v) => v > 1 && v < 1000, {
      message: 'odd must be in sensible decimal range (1, 1000)',
    }),
});

const MatchWinnerBetSchema = z.object({
  name: z.literal('Match Winner'),
  values: z.array(OddsValueSchema),
});

const BookmakerSchema = z.object({
  name: z.string().min(1),
  bets: z.array(MatchWinnerBetSchema),
});

const OddsFixtureSchema = z.object({
  id: z.number().int().positive(),
  date: z.string().datetime().optional(),
  timestamp: z.number().int().positive().optional(),
});

const OddsMatchSchema = z.object({
  fixture: OddsFixtureSchema,
  update: z.number().int().positive().optional(),
  bookmakers: z.array(BookmakerSchema),
});

export const OddsApiResponseSchema = z.object({
  response: z.array(OddsMatchSchema),
});

export type OddsApiResponse = z.infer<typeof OddsApiResponseSchema>;
export type OddsMatch = z.infer<typeof OddsMatchSchema>;
export type OddsBookmaker = z.infer<typeof BookmakerSchema>;
