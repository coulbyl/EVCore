export type PredictionLeagueConfig = {
  enabled: boolean;
  threshold: number;
  minSampleN: number;
};

export const PREDICTION_CONFIG: Record<string, PredictionLeagueConfig> = {
  // BL1 backtest 2026-04-19: 0.50 keeps validation while materially improving
  // coverage versus 0.60 (40.7% vs 14.1%).
  BL1: { enabled: true, threshold: 0.5, minSampleN: 10 },
  // D2 backtest 2026-04-19: no tested threshold clears the prediction hit-rate
  // floor, so disable pending future recalibration.
  D2: { enabled: false, threshold: 0.55, minSampleN: 10 },
  PL: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // SP2 backtest 2026-04-19: 0.50 misses the hit-rate floor; 0.55 restores a
  // valid prediction channel with acceptable coverage.
  SP2: { enabled: true, threshold: 0.55, minSampleN: 10 },
  POR: { enabled: true, threshold: 0.5, minSampleN: 10 },
  // LL backtest 2026-04-19: 0.50 keeps validation while materially expanding
  // coverage versus 0.60.
  LL: { enabled: true, threshold: 0.5, minSampleN: 20 },
  // F2 backtest 2026-04-19: no tested threshold clears the hit-rate floor.
  F2: { enabled: false, threshold: 0.5, minSampleN: 10 },
  // I2 backtest 2026-04-19: no tested threshold clears the hit-rate floor.
  I2: { enabled: false, threshold: 0.55, minSampleN: 10 },
  ERD: { enabled: true, threshold: 0.5, minSampleN: 10 },
  WCQE: { enabled: true, threshold: 0.5, minSampleN: 10 },
  // EL1 backtest 2026-04-19: 0.65 is too strict on coverage; 0.55 restores a
  // valid sample size while staying above the hit-rate floor.
  EL1: { enabled: true, threshold: 0.55, minSampleN: 20 },
  // EL2 backtest 2026-04-19: no tested threshold clears the hit-rate floor.
  EL2: { enabled: false, threshold: 0.55, minSampleN: 15 },
  // CH backtest 2026-04-19: 0.60 now validates and supports reactivation.
  CH: { enabled: true, threshold: 0.6, minSampleN: 20 },
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
