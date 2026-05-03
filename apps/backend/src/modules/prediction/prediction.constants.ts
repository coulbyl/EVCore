import { PredictionChannel } from '@evcore/db';

export type PredictionLeagueConfig = {
  enabled: boolean;
  threshold: number;
  minSampleN: number;
};

type PredictionChannelConfigMap = Partial<
  Record<PredictionChannel, PredictionLeagueConfig>
>;

const CONF_DEFAULT: PredictionLeagueConfig = {
  enabled: false,
  threshold: 0.99,
  minSampleN: 50,
};

const DRAW_DEFAULT: PredictionLeagueConfig = {
  enabled: false,
  threshold: 0.99,
  minSampleN: 20,
};

const BTTS_DEFAULT: PredictionLeagueConfig = {
  enabled: false,
  threshold: 0.99,
  minSampleN: 20,
};

export const PREDICTION_CHANNELS: PredictionChannel[] = [
  PredictionChannel.CONF,
  PredictionChannel.DRAW,
  PredictionChannel.BTTS,
];

export const PREDICTION_CONFIG: Record<string, PredictionChannelConfigMap> = {
  BL1: {
    // BL1 backtest 2026-04-19: 0.50 keeps validation while materially
    // improving coverage versus 0.60 (40.7% vs 14.1%).
    CONF: { enabled: true, threshold: 0.5, minSampleN: 10 },
    // BL1 backtest 2026-05-03: 0.56 covered 83% of fixtures — too broad.
    // 0.60 keeps 65% hit rate with 45% coverage, a meaningful selector.
    BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
  },
  D2: {
    // D2 backtest 2026-04-19: no tested threshold clears the prediction
    // hit-rate floor, so disable pending future recalibration.
    CONF: { enabled: false, threshold: 0.55, minSampleN: 10 },
    // D2 backtest 2026-05-03: BTTS signal validates across all thresholds.
    // 0.60 gives 63% hit rate with 33% coverage — best balance for D2.
    BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
  },
  PL: {
    // PL backtest 2026-05-02: CONF remains validated at 0.55.
    CONF: { enabled: true, threshold: 0.55, minSampleN: 10 },
    // PL backtest 2026-05-02: DRAW produced no qualified predictions and
    // should stay disabled until the selection pipeline improves.
    DRAW: { enabled: false, threshold: 0.34, minSampleN: 10 },
    // PL backtest 2026-05-03: 0.58 improves hit rate to 64.1% (vs 60.6% at
    // 0.55) while keeping 36% coverage — cleaner signal on a high-volume ligue.
    BTTS: { enabled: true, threshold: 0.58, minSampleN: 10 },
  },
  SP2: {
    // SP2 backtest 2026-05-02: 0.55 remains the best CONF balance.
    CONF: { enabled: true, threshold: 0.55, minSampleN: 10 },
    // SP2 backtest 2026-05-02: DRAW stays structurally weak even with a
    // dedicated low-threshold scan, so keep it disabled.
    DRAW: { enabled: false, threshold: 0.35, minSampleN: 6 },
    // SP2 backtest 2026-05-02: BTTS validates once calibrated independently
    // from the EV pick pipeline.
    BTTS: { enabled: true, threshold: 0.58, minSampleN: 20 },
  },
  POR: {
    CONF: { enabled: true, threshold: 0.5, minSampleN: 10 },
    // POR backtest 2026-05-03: draw probs never exceed 0.28; hit rate 34% at
    // best — structural Poisson limitation. No prediction produced at 0.35.
    DRAW: { enabled: false, threshold: 0.35, minSampleN: 6 },
  },
  LL: {
    // LL backtest 2026-04-19: 0.50 keeps validation while materially
    // expanding coverage versus 0.60.
    CONF: { enabled: true, threshold: 0.5, minSampleN: 20 },
    // LL backtest 2026-05-03: 0.57 produced only 58 picks (6.2% coverage, FAIL).
    // 0.55 keeps the same 62.1% hit rate with 158 picks and 17% coverage (PASS).
    BTTS: { enabled: true, threshold: 0.55, minSampleN: 10 },
  },
  F2: {
    // F2 backtest 2026-05-03: 0.55 validates at 58% hit rate on 112 picks
    // (13.4% coverage). Narrow window — 0.50 and 0.60 both fail. minSampleN
    // raised to 15 for robustness given the single-threshold pass.
    CONF: { enabled: true, threshold: 0.55, minSampleN: 15 },
  },
  I2: {
    // I2 backtest 2026-04-19: no tested threshold clears the hit-rate floor.
    CONF: { enabled: false, threshold: 0.55, minSampleN: 10 },
  },
  ERD: {
    CONF: { enabled: true, threshold: 0.5, minSampleN: 10 },
    BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
  },
  WCQE: {
    // WCQE backtest 2026-05-03: CONF strong at 0.50 (70.8%, 66 fixtures — lopsided matchups).
    CONF: { enabled: true, threshold: 0.5, minSampleN: 10 },
    // WCQE backtest 2026-05-03: BTTS validates at 0.50 (64.1%, 39 picks). Small sample but clean.
    BTTS: { enabled: true, threshold: 0.5, minSampleN: 10 },
  },
  EL1: {
    // EL1 backtest 2026-04-19: 0.65 is too strict on coverage; 0.55 restores
    // a valid sample size while staying above the hit-rate floor.
    CONF: { enabled: true, threshold: 0.55, minSampleN: 20 },
    // EL1 backtest 2026-05-03: 0.58 is the only valid BTTS threshold (55.6%,
    // 196 picks). Fragile single-window — monitor each season.
    BTTS: { enabled: true, threshold: 0.58, minSampleN: 15 },
  },
  EL2: {
    // EL2 backtest 2026-04-19: no tested threshold clears the hit-rate floor.
    CONF: { enabled: false, threshold: 0.55, minSampleN: 15 },
    // EL2 backtest 2026-05-03: BTTS validates at 0.58 (57.8%) and 0.60 (59%).
    // 0.60 preferred for better precision (11% coverage, 161 picks).
    BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
  },
  CH: {
    // CH backtest 2026-04-19: 0.60 now validates and supports reactivation.
    CONF: { enabled: true, threshold: 0.6, minSampleN: 20 },
    // CH backtest 2026-05-03: BTTS validates at 0.50 and 0.52 only — window
    // closes at 0.55 (coverage drops). 0.52 preferred for selectivity.
    BTTS: { enabled: true, threshold: 0.52, minSampleN: 10 },
  },
  L1: {
    // L1 backtest 2026-05-03: never configured — fell to defaults. Strong
    // progressive scan: 0.60 gives 66% hit rate (16% coverage, 122 picks).
    CONF: { enabled: true, threshold: 0.6, minSampleN: 10 },
    // L1 backtest 2026-05-03: low-BTTS league, 0.58 is the lowest valid
    // threshold (55.4%, 157 picks). Fragile — minSampleN raised to 15.
    BTTS: { enabled: true, threshold: 0.58, minSampleN: 15 },
  },
  MX1: {
    // MX1 backtest 2026-05-03: CONF validates at 0.55 (61.5%, 23.3% coverage).
    CONF: { enabled: true, threshold: 0.55, minSampleN: 10 },
    // MX1 backtest 2026-05-03: DRAW never exceeds 0.26 — Poisson limitation. Disable.
    DRAW: { enabled: false, threshold: 0.36, minSampleN: 5 },
    // MX1 backtest 2026-05-03: BTTS high-BTTS league, coverage collapses above 0.65.
    // 0.65 gives 60.2% hit rate with 30.2% coverage — best balance (259 picks).
    BTTS: { enabled: true, threshold: 0.65, minSampleN: 10 },
  },
  FRI: {
    // FRI backtest 2026-05-03: only 44 fixtures total — no signal derivable.
    CONF: { enabled: false, threshold: 0.99, minSampleN: 50 },
  },
  SA: {
    // SA backtest 2026-05-03: CONF signal never used (default 0.99). Scan
    // shows 65.4% hit rate at 0.50 on 335 picks — strong, activating now.
    CONF: { enabled: true, threshold: 0.5, minSampleN: 10 },
    // SA backtest 2026-05-03: 0.58 produced only 3 picks (INSUFFICIENT_DATA).
    // Serie A is a low-BTTS league; 0.52 is the only valid threshold
    // (60% hit rate, 115 picks, 12% coverage).
    BTTS: { enabled: true, threshold: 0.52, minSampleN: 10 },
  },
  UNL: {
    // UNL backtest 2026-05-03: CONF never clears 55% hit rate floor. Keep disabled.
    CONF: { enabled: false, threshold: 0.99, minSampleN: 50 },
    // UNL backtest 2026-05-03: BTTS validates at 0.55 (62.2%, 37 picks, 68.5% coverage).
    BTTS: { enabled: true, threshold: 0.55, minSampleN: 10 },
  },
  UEL: {
    // UEL backtest 2026-05-03: CONF validates only at 0.65 (57.6%, 10% coverage, 66 picks).
    // Fragile single-window — monitor each season.
    CONF: { enabled: true, threshold: 0.65, minSampleN: 20 },
    // UEL backtest 2026-05-03: DRAW was configured enabled but 14.3% hr at 0.34 — structural fail.
    DRAW: { enabled: false, threshold: 0.34, minSampleN: 5 },
    // UEL backtest 2026-05-03: BTTS validates at 0.60 (62.8% hr, 86 picks, 13.1% coverage).
    // 0.58 also passes (55.9%) but 0.60 is cleaner.
    BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
  },
  UECL: {
    // UECL backtest 2026-05-03: CONF strong — 0.60 gives 62.2% hr with 22.6% coverage (135 picks).
    CONF: { enabled: true, threshold: 0.6, minSampleN: 10 },
    // UECL backtest 2026-05-03: BTTS never clears 55% hit rate — all thresholds FAIL. Keep disabled.
    BTTS: { enabled: false, threshold: 0.99, minSampleN: 50 },
  },
  UCL: {
    // UCL backtest 2026-05-03: CONF validates cleanly at 0.55 (59.7%, 28.1% coverage, 159 picks).
    CONF: { enabled: true, threshold: 0.55, minSampleN: 10 },
    // UCL backtest 2026-05-03: BTTS validates at 0.60 (58.7%, 22.3% coverage, 126 picks).
    BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
  },
  J1: {
    // J1 backtest 2026-05-03: CONF never clears 50% hit rate floor. BTTS validates
    // at 0.58 (56%, 26.9% coverage, 268 picks) — best balance for the league.
    BTTS: { enabled: true, threshold: 0.58, minSampleN: 10 },
  },
  POL1: {
    // POL1 backtest 2026-05-03: CONF no PASS. BTTS validates progressively;
    // 0.58 gives 62.6% hr with 16.8% coverage (123 picks) — better precision than 0.50.
    BTTS: { enabled: true, threshold: 0.58, minSampleN: 10 },
  },
  SUI1: {
    // SUI1 backtest 2026-05-03: CONF validates only at 0.60 (55.4%, 14.8%, 83 picks).
    // Fragile single-window — minSampleN raised to 15.
    CONF: { enabled: true, threshold: 0.6, minSampleN: 15 },
    // SUI1 backtest 2026-05-03: BTTS 0.60 gives 60.6% hr with 22.6% coverage (127 picks).
    BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
  },
  TUR1: {
    // TUR1 backtest 2026-05-03: CONF strong progressive signal — 0.55 gives 67.5% hr
    // with 29.6% coverage (252 picks). Clear favourite league.
    CONF: { enabled: true, threshold: 0.55, minSampleN: 10 },
  },
  TUR2: {
    // TUR2 backtest 2026-05-03: CONF extraordinarily strong — 0.60 gives 73.9% hr with
    // 23.3% coverage (211 picks). Chosen over 0.65/0.70 for robustness.
    CONF: { enabled: true, threshold: 0.6, minSampleN: 10 },
  },
  SWE1: {
    // SWE1 backtest 2026-05-03: CONF validates at 0.55 (58.5%, 32.5%, 195 picks).
    CONF: { enabled: true, threshold: 0.55, minSampleN: 10 },
    // SWE1 backtest 2026-05-03: BTTS 0.58 gives 60.6% hr with 17.3% coverage (104 picks).
    // Preferred over 0.55 for precision.
    BTTS: { enabled: true, threshold: 0.58, minSampleN: 10 },
  },
  SWE2: {
    // SWE2 backtest 2026-05-03: CONF no PASS. BTTS marginal at 0.55 (56.2%, 32%, 192 picks)
    // — passes criteria, monitor closely.
    BTTS: { enabled: true, threshold: 0.55, minSampleN: 10 },
  },
  MLS: {
    // MLS backtest 2026-05-03: CONF no PASS. BTTS high-BTTS league — coverage collapses
    // above 0.62. 0.62 gives 65.5% hr with 19.1% coverage (174 picks).
    BTTS: { enabled: true, threshold: 0.62, minSampleN: 10 },
  },
  NOR1: {
    // NOR1 backtest 2026-05-03: CONF validates cleanly at 0.55 (61%, 34.7%, 205 picks).
    CONF: { enabled: true, threshold: 0.55, minSampleN: 10 },
    // NOR1 backtest 2026-05-03: BTTS 0.62 gives 67.1% hr with 11.8% coverage (70 picks).
    BTTS: { enabled: true, threshold: 0.62, minSampleN: 10 },
  },
  CZE1: {
    // CZE1 backtest 2026-05-03: CONF strong at 0.55 (65.4%, 34.4%, 228 picks).
    CONF: { enabled: true, threshold: 0.55, minSampleN: 10 },
    // CZE1 backtest 2026-05-03: BTTS validates only at 0.50 and 0.52; above 0.55 FAIL.
    // 0.52 preferred for selectivity (56%, 38% coverage, 252 picks).
    BTTS: { enabled: true, threshold: 0.52, minSampleN: 10 },
  },
  SRB1: {
    // SRB1 backtest 2026-05-03: CONF validates at 0.55 (63.1%, 30.3%, 217 picks).
    CONF: { enabled: true, threshold: 0.55, minSampleN: 10 },
    // SRB1 backtest 2026-05-03: BTTS 0.58 gives 57.8% hr with 12.6% coverage (90 picks).
    BTTS: { enabled: true, threshold: 0.58, minSampleN: 10 },
  },
};

export function getPredictionConfig(
  channel: PredictionChannel,
  competitionCode: string | null | undefined,
): PredictionLeagueConfig {
  const leagueConfig =
    competitionCode != null ? PREDICTION_CONFIG[competitionCode] : undefined;
  const channelConfig = leagueConfig?.[channel];

  if (channelConfig) return channelConfig;

  if (channel === PredictionChannel.DRAW) return DRAW_DEFAULT;
  if (channel === PredictionChannel.BTTS) return BTTS_DEFAULT;
  return CONF_DEFAULT;
}
