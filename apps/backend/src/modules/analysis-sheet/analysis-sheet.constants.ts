export const ANALYSIS_SHEET_PROMPT_VERSION = 'eva-analysis-v2-2026-07-04';

export const ANALYSIS_SHEET_MODELS = {
  // Default (free tier): higher TPM budget than gpt-oss-120b on our Groq
  // plan. Override via CHAT_GROQ_MODEL once the gpt-oss-120b tier is paid.
  scout: 'meta-llama/llama-4-scout-17b-16e-instruct',
  light: 'openai/gpt-oss-20b',
} as const;

export const ANALYSIS_SHEET_LIMITS = {
  maxRangeDays: 90,
  maxFixturesForAnalysis: 60,
  defaultDailyLimit: 50,
} as const;

// Coupon composition proposed by Eva but always recomputed and validated by
// the backend (legs resolved against the sheet, odds/stakes via decimal.js —
// LLM numbers are never trusted).
export const ANALYSIS_SHEET_COUPONS = {
  // 3 profils : Sécurité, Équilibré, Value (eva-gpt-instruction.md).
  maxCoupons: 3,
  minLegs: 2,
  maxLegs: 5,
  // Stakes are rounded up to this unit so the payout always covers the target.
  stakeRoundingUnit: 100,
  maxTargetWinAmount: 100_000_000,
  // Minimum prior rolling-horizon passes a pick's history must carry before
  // it can enter a coupon — a pick that just appeared (0-1 prior snapshots)
  // is a single data point with no line-movement trail to sanity-check it
  // against (audit 2026-07-09, rapport-dev-evcore-fiche).
  minHistorySnapshots: 2,
} as const;

// Channels covered by the sheet — the "primary" staked/decided channels
// (excludes meta-channels AVOID/CONSENSUS and the not-yet-viable
// CORRECT_SCORE, which has near-zero settled volume — see docs/ml-worker-sync.md).
export const ANALYSIS_SHEET_CHANNELS = [
  'VALUE',
  'SAFE',
  'DOMINANT',
  'BTTS',
  'DRAW',
  'GOALS',
] as const;
export type AnalysisSheetChannel = (typeof ANALYSIS_SHEET_CHANNELS)[number];
