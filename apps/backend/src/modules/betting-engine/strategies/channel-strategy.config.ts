import Decimal from 'decimal.js';

// DOMINANT picks are rejected when the argmax outcome leads the 2nd-best by less
// than this margin — prevents "barely-DOMINANT" picks where all three outcomes
// cluster near 33% (model has no real conviction).
export const DOMINANT_MIN_MARGIN = new Decimal('0.05');

export type ChannelStrategyLeagueConfig = {
  enabled: boolean;
  threshold: number;
  minSampleN: number;
};

export type ChannelStrategyConfigChannel = 'DOMINANT' | 'DRAW' | 'BTTS';

type ChannelStrategyConfigMap = Partial<
  Record<ChannelStrategyConfigChannel, ChannelStrategyLeagueConfig>
>;

const DOMINANT_DEFAULT: ChannelStrategyLeagueConfig = {
  enabled: false,
  threshold: 0.99,
  minSampleN: 50,
};

const DRAW_DEFAULT: ChannelStrategyLeagueConfig = {
  enabled: false,
  threshold: 0.99,
  minSampleN: 20,
};

const BTTS_DEFAULT: ChannelStrategyLeagueConfig = {
  enabled: false,
  threshold: 0.99,
  minSampleN: 20,
};

export const CHANNEL_STRATEGY_CONFIG_CHANNELS: ChannelStrategyConfigChannel[] =
  ['DOMINANT', 'DRAW', 'BTTS'];

export const CHANNEL_STRATEGY_CONFIG: Record<string, ChannelStrategyConfigMap> =
  {
    BL1: {
      // BL1 backtest 2026-04-19: 0.50 keeps validation while materially
      // improving coverage versus 0.60 (40.7% vs 14.1%).
      DOMINANT: { enabled: true, threshold: 0.5, minSampleN: 10 },
      // BL1 backtest 2026-05-05: strongest DRAW signal after I2. All 3 seasons
      // PASS: 2023-24 +17.8%, 2024-25 +14.1%, 2025-26 +33.4%. Aggregate
      // (186 picks, ~62/s): HR 35.5%, ROI +21.4%. threshold 0.28 = 1/3.57.
      DRAW: { enabled: true, threshold: 0.28, minSampleN: 10 },
      // BL1 backtest 2026-05-03: 0.56 covered 83% of fixtures — too broad.
      // 0.60 keeps 65% hit rate with 45% coverage, a meaningful selector.
      BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
    },
    D2: {
      // D2 backtest 2026-04-19: no tested threshold clears the prediction
      // hit-rate floor, so disable pending future recalibration.
      DOMINANT: { enabled: false, threshold: 0.55, minSampleN: 10 },
      // D2 backtest 2026-05-03: BTTS signal validates across all thresholds.
      // 0.60 gives 63% hit rate with 33% coverage — best balance for D2.
      BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
    },
    PL: {
      // PL backtest 2026-05-02: DOMINANT remains validated at 0.55.
      DOMINANT: { enabled: true, threshold: 0.55, minSampleN: 10 },
      // PL backtest 2026-05-02: DRAW produced no qualified predictions and
      // should stay disabled until the selection pipeline improves.
      DRAW: { enabled: false, threshold: 0.34, minSampleN: 10 },
      // PL backtest 2026-05-03: 0.58 improves hit rate to 64.1% (vs 60.6% at
      // 0.55) while keeping 36% coverage — cleaner signal on a high-volume ligue.
      BTTS: { enabled: true, threshold: 0.58, minSampleN: 10 },
    },
    SP2: {
      // SP2 backtest 2026-05-02: 0.55 remains the best DOMINANT balance.
      DOMINANT: { enabled: true, threshold: 0.55, minSampleN: 10 },
      // SP2 backtest 2026-05-02: DRAW stays structurally weak even with a
      // dedicated low-threshold scan, so keep it disabled.
      DRAW: { enabled: false, threshold: 0.35, minSampleN: 6 },
      // SP2 backtest 2026-05-02: BTTS validates once calibrated independently
      // from the EV pick pipeline.
      BTTS: { enabled: true, threshold: 0.58, minSampleN: 20 },
    },
    POR: {
      DOMINANT: { enabled: true, threshold: 0.5, minSampleN: 10 },
      // POR backtest 2026-05-05: 1/drawOdds signal validates where Poisson failed.
      // 2/3 seasons PASS: 2023-24 +37.0%, 2024-25 +0.9% (borderline), 2025-26 +8.9%.
      // Aggregate (257 picks, ~86/s): HR 35.8%, ROI +12.7%. threshold 0.30 = 1/3.33.
      DRAW: { enabled: true, threshold: 0.3, minSampleN: 10 },
    },
    LL: {
      // LL backtest 2026-04-19: 0.50 keeps validation while materially
      // expanding coverage versus 0.60.
      DOMINANT: { enabled: true, threshold: 0.5, minSampleN: 20 },
      // LL backtest 2026-05-03: 0.57 produced only 58 picks (6.2% coverage, FAIL).
      // 0.55 keeps the same 62.1% hit rate with 158 picks and 17% coverage (PASS).
      BTTS: { enabled: true, threshold: 0.55, minSampleN: 10 },
    },
    F2: {
      // F2 backtest 2026-05-03: 0.55 validates at 58% hit rate on 112 picks
      // (13.4% coverage). Narrow window — 0.50 and 0.60 both fail. minSampleN
      // raised to 15 for robustness given the single-threshold pass.
      DOMINANT: { enabled: true, threshold: 0.55, minSampleN: 15 },
    },
    I2: {
      // I2 backtest 2026-04-19: no tested threshold clears the hit-rate floor.
      DOMINANT: { enabled: false, threshold: 0.55, minSampleN: 10 },
      // I2 backtest 2026-05-05: strongest DRAW signal in the panel.
      // Aggregate 3 seasons (672 picks): HR 36.3%, ROI +11.1% at 0.30.
      // Consistent: 2023-24 +16.4%, 2024-25 +12.3%, 2025-26 +6.5%.
      // threshold 0.30 = 1/3.33 → selects drawOdds < 3.33.
      DRAW: { enabled: true, threshold: 0.3, minSampleN: 10 },
    },
    ERD: {
      DOMINANT: { enabled: true, threshold: 0.5, minSampleN: 10 },
      BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
    },
    WC: {
      // WC backtest 2026-06-02 (WC 2022, cross-comp fallback from WCQ qualifying seasons).
      // Brier 0.654 / CalibError 3.1% with NATIONAL_TEAM_CROSS_COMP_FORM_WEIGHT=1.0 (xG ignored —
      // non-European qualifying competitions don't provide reliable xG data).
      // DOMINANT: only 0.60 clears the 55% floor (55.6%, 9 picks, 14% coverage). Fragile on 64 fixtures.
      DOMINANT: { enabled: true, threshold: 0.6, minSampleN: 10 },
      // DRAW: observation mode. No validated signal (ROI negative at all tested thresholds).
      // WC group stage historical draw rate ~17-23%. Threshold 0.25 = drawOdds < 4.00.
      // Raised from 0.20 → 0.25 (2026-06-14) after 5 settled picks: Mexico-SA (4.42, ❌) was the
      // only pick priced above 4.00 — filtering it retrospectively keeps the two correct picks intact.
      // minSampleN=5 to collect data from WC 2026 group stage without blocking picks.
      DRAW: { enabled: true, threshold: 0.25, minSampleN: 5 },
      // BTTS: observation mode. WC historically ~48% BTTS rate but model caps BTTS probs at ~0.47
      // because WCQ cross-comp stats underestimate goal-scoring in tournament context (qualifying is
      // more defensive). Threshold 0.35 = below normal 0.50 floor, will fire on ~58% of fixtures.
      // HR on WC 2022 at 0.35: 40.5% (37 picks) — not a validated signal, data collection only.
      BTTS: { enabled: true, threshold: 0.35, minSampleN: 5 },
    },
    WCQCA: {
      // WCQCA backtest 2026-06-02 (2026-27 season, 100 fixtures).
      // 0.75 clears 55% floor in 2026-27: 43 picks, 60.5% HR, 44.8% coverage.
      // 2022-23 showed stronger signal at lower thresholds but WC 2026 expanded format
      // (48 teams) makes qualifs more competitive — use recent season as reference.
      DOMINANT: { enabled: true, threshold: 0.75, minSampleN: 10 },
      // DRAW: below 20% HR in 2022-23. Single season (2026-27 at 0.28: 70% HR, 10 picks) too fragile.
    },
    WCQSA: {
      // WCQSA backtest 2026-06-02 (2026-27 season, 90 fixtures).
      // 0.60 validates in both seasons: 2022-23 78.9%/19 picks, 2026-27 57.1%/21 picks.
      DOMINANT: { enabled: true, threshold: 0.6, minSampleN: 10 },
      // DRAW: negative ROI across all thresholds. Disabled.
    },
    WCQAS: {
      // WCQAS backtest 2026-06-02 (2026-27 season, 226 fixtures).
      // 0.75 is the lowest threshold that passes in 2026-27: 26 picks, 65.4%, 11.5% coverage.
      // 2022-23 showed extraordinary signal (84%+ HR from 0.50 upward) but 2026-27 expanded
      // format weakened it significantly — 0.75 is the conservative cross-season choice.
      // DRAW: 2026-27 at 0.28 ROI +13.4% (PASS) but 2022-23 doesn't validate. Monitor.
      DOMINANT: { enabled: true, threshold: 0.75, minSampleN: 10 },
    },
    WCQAF: {
      // WCQAF backtest 2026-06-02 (2023-24 season, 92 fixtures — most recent available).
      // 0.55 validates strongly: 26 picks, 80.8% HR, 28.3% coverage.
      // 2022-23 showed weak signal (11 picks at 0.50). 2023-24 is more reliable reference.
      DOMINANT: { enabled: true, threshold: 0.55, minSampleN: 10 },
      // DRAW: consistently negative across both seasons. Disabled.
    },
    // WCQOC: only 16 fixtures total — insufficient sample to derive any signal.
    WCQE: {
      // WCQE backtest 2026-05-03: DOMINANT strong at 0.50 (70.8%, 66 fixtures — lopsided matchups).
      DOMINANT: { enabled: true, threshold: 0.5, minSampleN: 10 },
      // WCQE backtest 2026-05-03: BTTS validates at 0.50 (64.1%, 39 picks). Small sample but clean.
      BTTS: { enabled: true, threshold: 0.5, minSampleN: 10 },
    },
    EL1: {
      // EL1 backtest 2026-04-19: 0.65 is too strict on coverage; 0.55 restores
      // a valid sample size while staying above the hit-rate floor.
      DOMINANT: { enabled: true, threshold: 0.55, minSampleN: 20 },
      // EL1 backtest 2026-05-03: 0.58 is the only valid BTTS threshold (55.6%,
      // 196 picks). Fragile single-window — monitor each season.
      BTTS: { enabled: true, threshold: 0.58, minSampleN: 15 },
    },
    EL2: {
      // EL2 backtest 2026-04-19: no tested threshold clears the hit-rate floor.
      DOMINANT: { enabled: false, threshold: 0.55, minSampleN: 15 },
      // EL2 backtest 2026-05-03: BTTS validates at 0.58 (57.8%) and 0.60 (59%).
      // 0.60 preferred for better precision (11% coverage, 161 picks).
      BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
    },
    CH: {
      // CH backtest 2026-04-19: 0.60 now validates and supports reactivation.
      DOMINANT: { enabled: true, threshold: 0.6, minSampleN: 20 },
      // CH backtest 2026-05-03: BTTS validates at 0.50 and 0.52 only — window
      // closes at 0.55 (coverage drops). 0.52 preferred for selectivity.
      BTTS: { enabled: true, threshold: 0.52, minSampleN: 10 },
    },
    L1: {
      // L1 backtest 2026-05-03: never configured — fell to defaults. Strong
      // progressive scan: 0.60 gives 66% hit rate (16% coverage, 122 picks).
      DOMINANT: { enabled: true, threshold: 0.6, minSampleN: 10 },
      // L1 backtest 2026-05-03: low-BTTS league, 0.58 is the lowest valid
      // threshold (55.4%, 157 picks). Fragile — minSampleN raised to 15.
      BTTS: { enabled: true, threshold: 0.58, minSampleN: 15 },
    },
    MX1: {
      // MX1 backtest 2026-05-03: DOMINANT validates at 0.55 (61.5%, 23.3% coverage).
      DOMINANT: { enabled: true, threshold: 0.55, minSampleN: 10 },
      // MX1 backtest 2026-05-03: DRAW never exceeds 0.26 — Poisson limitation. Disable.
      DRAW: { enabled: false, threshold: 0.36, minSampleN: 5 },
      // MX1 backtest 2026-05-03: BTTS high-BTTS league, coverage collapses above 0.65.
      // 0.65 gives 60.2% hit rate with 30.2% coverage — best balance (259 picks).
      BTTS: { enabled: true, threshold: 0.65, minSampleN: 10 },
    },
    FRI: {
      // FRI backtest 2026-05-03: only 44 fixtures total — no signal derivable.
      DOMINANT: { enabled: false, threshold: 0.99, minSampleN: 50 },
    },
    SA: {
      // SA backtest 2026-05-03: DOMINANT signal never used (default 0.99). Scan
      // shows 65.4% hit rate at 0.50 on 335 picks — strong, activating now.
      DOMINANT: { enabled: true, threshold: 0.5, minSampleN: 10 },
      // SA analysis 2026-05-05: 1/drawOdds signal. Bracket [3.20–3.33) is the
      // sweet spot: [3.20–3.40) shows +13.6% ROI on 213 fixtures (SQL analysis).
      // threshold 0.30 = 1/3.33 → selects drawOdds < 3.33, centred on the best bracket.
      // Validation metric: ROI ≥ +5% + HR ≥ 32% (not hit rate 55% — see DRAW-SA-ANALYSIS.md).
      DRAW: { enabled: true, threshold: 0.3, minSampleN: 10 },
      // SA backtest 2026-05-03: 0.58 produced only 3 picks (INSUFFICIENT_DATA).
      // Serie A is a low-BTTS league; 0.52 is the only valid threshold
      // (60% hit rate, 115 picks, 12% coverage).
      BTTS: { enabled: true, threshold: 0.52, minSampleN: 10 },
    },
    UNL: {
      // UNL backtest 2026-05-03: DOMINANT never clears 55% hit rate floor. Keep disabled.
      DOMINANT: { enabled: false, threshold: 0.99, minSampleN: 50 },
      // UNL backtest 2026-05-03: BTTS validates at 0.55 (62.2%, 37 picks, 68.5% coverage).
      BTTS: { enabled: true, threshold: 0.55, minSampleN: 10 },
    },
    UEL: {
      // UEL backtest 2026-05-03: DOMINANT validates only at 0.65 (57.6%, 10% coverage, 66 picks).
      // Fragile single-window — monitor each season.
      DOMINANT: { enabled: true, threshold: 0.65, minSampleN: 20 },
      // UEL backtest 2026-05-03: DRAW was configured enabled but 14.3% hr at 0.34 — structural fail.
      DRAW: { enabled: false, threshold: 0.34, minSampleN: 5 },
      // UEL backtest 2026-05-03: BTTS validates at 0.60 (62.8% hr, 86 picks, 13.1% coverage).
      // 0.58 also passes (55.9%) but 0.60 is cleaner.
      BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
    },
    UECL: {
      // UECL backtest 2026-05-03: DOMINANT strong — 0.60 gives 62.2% hr with 22.6% coverage (135 picks).
      DOMINANT: { enabled: true, threshold: 0.6, minSampleN: 10 },
      // UECL backtest 2026-05-03: BTTS never clears 55% hit rate — all thresholds FAIL. Keep disabled.
      BTTS: { enabled: false, threshold: 0.99, minSampleN: 50 },
    },
    UCL: {
      // UCL backtest 2026-05-03: DOMINANT validates cleanly at 0.55 (59.7%, 28.1% coverage, 159 picks).
      DOMINANT: { enabled: true, threshold: 0.55, minSampleN: 10 },
      // UCL backtest 2026-05-03: BTTS validates at 0.60 (58.7%, 22.3% coverage, 126 picks).
      BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
    },
    J1: {
      // J1 backtest 2026-05-03: DOMINANT never clears 50% hit rate floor. BTTS validates
      // at 0.58 (56%, 26.9% coverage, 268 picks) — best balance for the league.
      BTTS: { enabled: true, threshold: 0.58, minSampleN: 10 },
    },
    POL1: {
      // POL1 backtest 2026-05-03: DOMINANT no PASS. BTTS validates progressively;
      // 0.58 gives 62.6% hr with 16.8% coverage (123 picks) — better precision than 0.50.
      BTTS: { enabled: true, threshold: 0.58, minSampleN: 10 },
    },
    SUI1: {
      // SUI1 backtest 2026-05-03: DOMINANT validates only at 0.60 (55.4%, 14.8%, 83 picks).
      // Fragile single-window — minSampleN raised to 15.
      DOMINANT: { enabled: true, threshold: 0.6, minSampleN: 15 },
      // SUI1 backtest 2026-05-03: BTTS 0.60 gives 60.6% hr with 22.6% coverage (127 picks).
      BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
    },
    TUR1: {
      // TUR1 backtest 2026-05-03: DOMINANT strong progressive signal — 0.55 gives 67.5% hr
      // with 29.6% coverage (252 picks). Clear favourite league.
      DOMINANT: { enabled: true, threshold: 0.55, minSampleN: 10 },
    },
    TUR2: {
      // TUR2 backtest 2026-05-03: DOMINANT extraordinarily strong — 0.60 gives 73.9% hr with
      // 23.3% coverage (211 picks). Chosen over 0.65/0.70 for robustness.
      DOMINANT: { enabled: true, threshold: 0.6, minSampleN: 10 },
    },
    SWE1: {
      // SWE1 backtest 2026-05-03: DOMINANT validates at 0.55 (58.5%, 32.5%, 195 picks).
      DOMINANT: { enabled: true, threshold: 0.55, minSampleN: 10 },
      // SWE1 backtest 2026-05-03: BTTS 0.58 gives 60.6% hr with 17.3% coverage (104 picks).
      // Preferred over 0.55 for precision.
      BTTS: { enabled: true, threshold: 0.58, minSampleN: 10 },
      // SWE1 backtest 2026-05-24: DRAW ROI +10.9% on 43 preds at 0.30 (cote implicite < 3.33).
      DRAW: { enabled: true, threshold: 0.3, minSampleN: 10 },
    },
    SWE2: {
      // SWE2 backtest 2026-05-03: DOMINANT no PASS. BTTS marginal at 0.55 (56.2%, 32%, 192 picks)
      // — passes criteria, monitor closely.
      BTTS: { enabled: true, threshold: 0.55, minSampleN: 10 },
    },
    KOR1: {
      // KOR1 backtest 2026-05-24: DRAW ROI +23.2% on 140 preds at 0.26 — strong signal.
      DRAW: { enabled: true, threshold: 0.26, minSampleN: 10 },
      // KOR1 backtest 2026-05-24: BTTS 58.5% HR on 82 preds at 0.55.
      BTTS: { enabled: true, threshold: 0.55, minSampleN: 10 },
      // KOR1: DOMINANT no PASS threshold found.
      DOMINANT: { enabled: false, threshold: 0.99, minSampleN: 10 },
    },
    CSL: {
      // CSL backtest 2026-05-24: DOMINANT exceptional — 0.60 gives 70% HR on 167 preds,
      // 0.65 gives 79% HR on 103 preds. Use 0.60 for volume + precision balance.
      DOMINANT: { enabled: true, threshold: 0.6, minSampleN: 10 },
      // CSL backtest 2026-05-24: DRAW ROI +18% on 80 preds at 0.28.
      DRAW: { enabled: true, threshold: 0.28, minSampleN: 10 },
      // CSL backtest 2026-05-24: BTTS 0.62 gives 74% HR on 68 preds — excellent precision.
      BTTS: { enabled: true, threshold: 0.62, minSampleN: 10 },
    },
    FIN1: {
      // FIN1 backtest 2026-05-24: DOMINANT validates at 0.55 (65% HR, 52 preds). Prefer 0.55
      // over 0.50 for precision (65% vs 60%).
      DOMINANT: { enabled: true, threshold: 0.55, minSampleN: 10 },
      // FIN1 backtest 2026-05-24: DRAW ROI +6.9% on 21 preds at 0.30. Marginal — monitor.
      DRAW: { enabled: true, threshold: 0.3, minSampleN: 10 },
      // FIN1 backtest 2026-05-24: BTTS validates at 0.55 (62% HR, 68 preds).
      BTTS: { enabled: true, threshold: 0.55, minSampleN: 10 },
    },
    BRA1: {
      // BRA1 backtest 2026-05-24: DOMINANT validates at 0.55 (60.6% HR, 175 predictions).
      DOMINANT: { enabled: true, threshold: 0.55, minSampleN: 10 },
      // BRA1 backtest 2026-05-24: DRAW ROI +20.7% on 29 predictions at 0.34. Marginal
      // sample — monitor closely.
      DRAW: { enabled: true, threshold: 0.34, minSampleN: 10 },
      // BRA1 backtest 2026-05-24: BTTS prediction — no threshold validates.
      BTTS: { enabled: false, threshold: 0.99, minSampleN: 10 },
    },
    MLS: {
      // MLS backtest 2026-05-03: DOMINANT no PASS. BTTS high-BTTS league — coverage collapses
      // above 0.62. 0.62 gives 65.5% hr with 19.1% coverage (174 picks).
      BTTS: { enabled: true, threshold: 0.62, minSampleN: 10 },
    },
    NOR1: {
      // NOR1 backtest 2026-05-03: DOMINANT validates cleanly at 0.55 (61%, 34.7%, 205 picks).
      DOMINANT: { enabled: true, threshold: 0.55, minSampleN: 10 },
      // NOR1 backtest 2026-05-03: BTTS 0.62 gives 67.1% hr with 11.8% coverage (70 picks).
      BTTS: { enabled: true, threshold: 0.62, minSampleN: 10 },
    },
    CZE1: {
      // CZE1 backtest 2026-05-03: DOMINANT strong at 0.55 (65.4%, 34.4%, 228 picks).
      DOMINANT: { enabled: true, threshold: 0.55, minSampleN: 10 },
      // CZE1 backtest 2026-05-03: BTTS validates only at 0.50 and 0.52; above 0.55 FAIL.
      // 0.52 preferred for selectivity (56%, 38% coverage, 252 picks).
      BTTS: { enabled: true, threshold: 0.52, minSampleN: 10 },
    },
    SRB1: {
      // SRB1 backtest 2026-05-03: DOMINANT validates at 0.55 (63.1%, 30.3%, 217 picks).
      DOMINANT: { enabled: true, threshold: 0.55, minSampleN: 10 },
      // SRB1 backtest 2026-05-03: BTTS 0.58 gives 57.8% hr with 12.6% coverage (90 picks).
      BTTS: { enabled: true, threshold: 0.58, minSampleN: 10 },
    },
  };

export function getChannelStrategyConfig(
  channel: ChannelStrategyConfigChannel,
  competitionCode: string | null | undefined,
): ChannelStrategyLeagueConfig {
  const leagueConfig =
    competitionCode != null
      ? CHANNEL_STRATEGY_CONFIG[competitionCode]
      : undefined;
  const channelConfig = leagueConfig?.[channel];

  if (channelConfig) return channelConfig;

  if (channel === 'DRAW') return DRAW_DEFAULT;
  if (channel === 'BTTS') return BTTS_DEFAULT;
  return DOMINANT_DEFAULT;
}
