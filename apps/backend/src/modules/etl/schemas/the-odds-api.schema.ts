import { z } from 'zod';

const OutcomeSchema = z.object({
  name: z.string(),
  price: z.number().positive(),
  // Present on totals (over/under) markets — indicates the line (e.g. 2.5)
  point: z.number().optional(),
});

const MarketSchema = z.object({
  key: z.string(),
  last_update: z.string(),
  outcomes: z.array(OutcomeSchema),
});

const BookmakerSchema = z.object({
  key: z.string(),
  title: z.string(),
  last_update: z.string(),
  markets: z.array(MarketSchema),
});

export const TheOddsApiEventSchema = z.object({
  id: z.string(),
  sport_key: z.string(),
  commence_time: z.string(), // ISO 8601
  home_team: z.string(),
  away_team: z.string(),
  bookmakers: z.array(BookmakerSchema),
});

// The API returns { data: [], timestamp: "..." } on success.
// On out-of-coverage dates it returns {} or { message: "..." } with no data/timestamp —
// default to empty array so the worker skips cleanly without a Zod warning.
export const TheOddsApiHistoricalResponseSchema = z.object({
  data: z.array(TheOddsApiEventSchema).default([]),
  timestamp: z.string().optional(),
  previous_timestamp: z.string().optional(),
  next_timestamp: z.string().optional(),
});

export type TheOddsApiEvent = z.infer<typeof TheOddsApiEventSchema>;
export type TheOddsApiHistoricalResponse = z.infer<
  typeof TheOddsApiHistoricalResponseSchema
>;
