export const ANALYSIS_SHEET_PROMPT_VERSION = 'eva-analysis-v1-2026-07-02';

export const ANALYSIS_SHEET_MODELS = {
  scout: 'meta-llama/llama-4-scout-17b-16e-instruct',
  light: 'llama-3.1-8b-instant',
} as const;

export const ANALYSIS_SHEET_LIMITS = {
  maxRangeDays: 90,
  maxFixturesForAnalysis: 60,
  defaultDailyLimit: 50,
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
