export type PredictionLeagueConfig = {
  enabled: boolean;
  threshold: number;
  minSampleN: number;
};

export const PREDICTION_CONFIG: Record<string, PredictionLeagueConfig> = {
  BL1: { enabled: true, threshold: 0.6, minSampleN: 10 },
  D2: { enabled: true, threshold: 0.55, minSampleN: 10 },
  PL: { enabled: true, threshold: 0.55, minSampleN: 10 },
  SP2: { enabled: true, threshold: 0.5, minSampleN: 10 },
  POR: { enabled: true, threshold: 0.5, minSampleN: 10 },
  LL: { enabled: true, threshold: 0.6, minSampleN: 20 },
  F2: { enabled: true, threshold: 0.5, minSampleN: 10 },
  I2: { enabled: true, threshold: 0.55, minSampleN: 10 },
  ERD: { enabled: true, threshold: 0.5, minSampleN: 10 },
  WCQE: { enabled: true, threshold: 0.5, minSampleN: 10 },
  EL1: { enabled: true, threshold: 0.65, minSampleN: 20 },
  EL2: { enabled: true, threshold: 0.55, minSampleN: 15 },
  CH: { enabled: false, threshold: 0.65, minSampleN: 20 },
  MX1: { enabled: false, threshold: 0.99, minSampleN: 50 },
  FRI: { enabled: false, threshold: 0.99, minSampleN: 50 },
  SA: { enabled: false, threshold: 0.99, minSampleN: 50 },
  UNL: { enabled: false, threshold: 0.99, minSampleN: 50 },
  UEL: { enabled: false, threshold: 0.99, minSampleN: 50 },
  UECL: { enabled: false, threshold: 0.99, minSampleN: 50 },
  UCL: { enabled: false, threshold: 0.99, minSampleN: 50 },
};

const PREDICTION_CONFIG_DEFAULT: PredictionLeagueConfig = {
  enabled: false,
  threshold: 0.99,
  minSampleN: 50,
};

export function getPredictionConfig(
  competitionCode: string | null | undefined,
): PredictionLeagueConfig {
  if (competitionCode != null && competitionCode in PREDICTION_CONFIG) {
    return PREDICTION_CONFIG[competitionCode];
  }
  return PREDICTION_CONFIG_DEFAULT;
}
