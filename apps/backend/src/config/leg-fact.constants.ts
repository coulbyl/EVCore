// The fact under each coupon leg (docs/refonte-ui/04 § 1): one sentence,
// one number, one team, true on the matches played before generation, and
// nothing at all when there is no solid one.

// The screen gives the fact one line.
export const LEG_FACT_MAX_LENGTH = 60;

// The history read per team and venue: the latest matches, within a year.
export const LEG_FACT_HISTORY_MATCHES = 10;
export const LEG_FACT_HISTORY_DAYS = 365;

// Fewer matches than this at the venue and no ratio is quoted.
export const LEG_FACT_MIN_MATCHES = 6;

// A run of at least this many straight matches is a fact on its own
// (« PSG a gagné ses 9 derniers matchs à domicile »).
export const LEG_FACT_MIN_STREAK = 5;

// Below these shares, « k of n » is not worth saying. Outcomes that are
// rare by nature (a draw, a draw at half time) have lower floors: four
// draws in eight matches is already a lot.
export const LEG_FACT_MIN_SHARE = {
  common: 0.7,
  draw: 0.4,
  halfTimeDraw: 0.5,
} as const;
