export const ANALYSIS_SHEET_LIMITS = {
  maxRangeDays: 90,
  // Le bloc `context` charge l'historique de chaque équipe des deux camps
  // (forme, buts sur deux saisons, xG, classement dérivé, H2H). Au-delà de
  // cette plage, le volume d'équipes concernées rend la requête déraisonnable
  // pour un export manuel : la fiche est servie sans `context`, avec le motif
  // dans `contextReason`. Le cas d'usage visé — un combiné du jour — tient
  // dans 1 à 3 jours.
  maxContextRangeDays: 7,
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

// Statuts de match acceptés par le filtre d'export v2 (FixtureStatus).
export const ANALYSIS_SHEET_STATUSES = [
  'SCHEDULED',
  'IN_PROGRESS',
  'FINISHED',
  'POSTPONED',
  'CANCELLED',
] as const;
