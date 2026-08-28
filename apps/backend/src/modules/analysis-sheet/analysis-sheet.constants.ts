export const ANALYSIS_SHEET_LIMITS = {
  maxRangeDays: 90,
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
  'TEAM_TOTAL',
] as const;
export type AnalysisSheetChannel = (typeof ANALYSIS_SHEET_CHANNELS)[number];
