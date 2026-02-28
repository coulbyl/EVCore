import { z } from 'zod';

// Schema for a single row from football-data.co.uk CSV
// Source: https://www.football-data.co.uk/mmz4281/{YYZZ}/E0.csv
// Confirmed columns for EPL 2021/22 – 2024/25 seasons.
// Pinnacle (PSC*) may be absent on some rows — all odds columns are optional.

const positiveOdd = z.coerce
  .number()
  .positive()
  .refine((v) => v > 1 && v < 1000, {
    message: 'odd must be in range (1, 1000)',
  });

export const OddsCsvRowSchema = z
  .object({
    Date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Expected DD/MM/YYYY'),
    HomeTeam: z.string().min(1),
    AwayTeam: z.string().min(1),
    FTHG: z.coerce.number().int().nonnegative(), // full-time home goals
    FTAG: z.coerce.number().int().nonnegative(), // full-time away goals
    FTR: z.enum(['H', 'D', 'A']), // full-time result

    // Bet365 opening odds
    B365H: positiveOdd.optional(),
    B365D: positiveOdd.optional(),
    B365A: positiveOdd.optional(),

    // Bet365 closing odds (pre-match, at kickoff)
    B365CH: positiveOdd.optional(),
    B365CD: positiveOdd.optional(),
    B365CA: positiveOdd.optional(),

    // Pinnacle closing odds — industry benchmark for true probability
    PSCH: positiveOdd.optional(),
    PSCD: positiveOdd.optional(),
    PSCA: positiveOdd.optional(),

    // Market average closing
    AvgCH: positiveOdd.optional(),
    AvgCD: positiveOdd.optional(),
    AvgCA: positiveOdd.optional(),
  })
  .passthrough(); // extra columns in the CSV are silently ignored

export type OddsCsvRow = z.infer<typeof OddsCsvRowSchema>;
