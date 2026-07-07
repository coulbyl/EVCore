// Probability buckets ("chance de gagner"), not an EV/qualityScore gate — see
// investment.service.ts for why EV is deliberately not used to exclude picks.
export const PROBABILITY_BUCKETS = {
  veryLikely: 0.8,
  solid: 0.65,
  moderate: 0.5,
} as const;

export type ProbabilityBucket =
  | 'veryLikely'
  | 'solid'
  | 'moderate'
  | 'speculative';

// A pick priced this short rarely justifies its own slot even when it hits —
// surfaced as a badge, never as an exclusion.
export const ODDS_SHORT_THRESHOLD = 1.2;

// Channels with a negative aggregate settled ROI in production (checked
// 2026-07-06: DOMINANT -23.27%, GOALS -26.05%, BTTS -37.22% over 7k-35k settled
// picks). Surfaced as a contextual badge only — a specific pick from one of
// these channels can still be a legitimate individual choice.
export const NEGATIVE_ROI_CHANNELS = ['DOMINANT', 'GOALS', 'BTTS'] as const;

export const INVESTMENT_LIMITS = {
  maxPicks: 15,
} as const;

// Per-channel probability calibration (see InvestmentCalibrationRepository).
export const INVESTMENT_CALIBRATION = {
  windowDays: 180,
  // Below this many settled picks in the window, a channel's measured bias
  // is too noisy to trust — skip correction rather than overcorrect.
  minSamples: 30,
} as const;

// OVER_UNDER pick code -> goal line. Used to detect GOALS channel picks whose
// direction contradicts the model's own Poisson lambda (see
// InvestmentCoherenceRepository) — verified 2026-07-06 on settled history:
// hit rate drops 7-9pp when the pick disagrees with lambda, on thousands of
// samples (e.g. "Under 2.5" picked while lambdaHome+lambdaAway > 2.5).
export const OVER_UNDER_LINES: Record<string, number> = {
  OVER_1_5: 1.5,
  UNDER_1_5: 1.5,
  OVER: 2.5,
  UNDER: 2.5,
  OVER_3_5: 3.5,
  UNDER_3_5: 3.5,
  OVER_4_5: 4.5,
  UNDER_4_5: 4.5,
};

export type SingleChannelMode = 'safe' | 'dominant' | 'btts' | 'goals' | 'draw';
export type InvestmentMode = 'probability' | 'value' | SingleChannelMode;

// EV only predicts a better outcome within VALUE — verified 2026-07-06 with a
// full day-by-day backtest (pnpm --filter @evcore/db db:backtest:ev-tiers):
// VALUE's EV>=0.08 tier is majority-positive-days (52.6%) with +10.73% ROI.
// SAFE's EV>=0.08 tier is actually WORSE than its own EV<0.08 tier on both
// measures (-3.42% ROI, and even -8.38% within its own "very likely"
// probability bucket) — EV is not SAFE's edge, probability is. DOMINANT/BTTS
// are similarly inverted or flat, GOALS shows no discrimination either way.
// Hence "value" mode is VALUE-only; every other channel gets its own
// probability-ranked mode instead (see SINGLE_CHANNEL_MODE_MAP).
export const VALUE_MODE_CHANNELS = ['VALUE'] as const;

// One mode per remaining channel, each restricted to that channel alone and
// ranked per MODE_RANKING below.
export const SINGLE_CHANNEL_MODE_MAP: Record<SingleChannelMode, string> = {
  safe: 'SAFE',
  dominant: 'DOMINANT',
  btts: 'BTTS',
  goals: 'GOALS',
  draw: 'DRAW',
};

export type ModeRankingSort = 'probability' | 'edge';

// Per-mode ranking + topN cap, measured day-by-day with the same leak-free
// calibration as the service (pnpm --filter @evcore/db
// db:backtest:invest-ranking, 2026-07-07, top5 ROI unless noted):
// - value/draw: calibrated edge (probability - 1/odds). On VALUE it is the
//   only ranking still positive on 2026 forward data (+2.3% vs -10.8% for
//   probability, -3.5% for raw EV); on DRAW it improves monotonically every
//   year (2023 -11% -> 2026 +12%) while probability ranks near random.
// - dominant: probability ranking already works — top5 is +3.3% all-time
//   while the full channel aggregates -23%; the problem is the tail of the
//   list, not the order. Edge/EV rankings are unstable there (-6% in 2024).
// - safe: every ranking is positive on 2026 but only 28 eligible top5 days
//   exist in total — too thin to switch formulas, so keep probability (its
//   established edge) and just cap the tail.
// - btts/goals: no ranking is reliably positive on any period — a topN cannot
//   fix those channels (their fix is model calibration), so no cap: the list
//   stays a full review surface with the channelRoiFlag badge as the signal.
export const MODE_RANKING = {
  probability: { sort: 'probability', topN: null },
  value: { sort: 'edge', topN: 5 },
  safe: { sort: 'probability', topN: 5 },
  dominant: { sort: 'probability', topN: 5 },
  btts: { sort: 'probability', topN: null },
  goals: { sort: 'probability', topN: null },
  draw: { sort: 'edge', topN: 5 },
} as const satisfies Record<
  InvestmentMode,
  { sort: ModeRankingSort; topN: number | null }
>;
