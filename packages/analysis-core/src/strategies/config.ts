import Decimal from "decimal.js";

// DOMINANT picks are rejected when the argmax outcome leads the 2nd-best by less
// than this margin — prevents "barely-DOMINANT" picks where all three outcomes
// cluster near 33% (model has no real conviction).
export const DOMINANT_MIN_MARGIN = new Decimal("0.05");

export type ChannelStrategyLeagueConfig = {
  enabled: boolean;
  threshold: number;
  minSampleN: number;
};

export type ChannelStrategyConfigChannel = "DOMINANT" | "DRAW" | "BTTS";

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

// BTTS NO side — calibrated SEPARATELY from YES (TODO Étape 7 / doc §6.1) and
// now PER-LEAGUE, OBSERVATION ONLY. BTTS is a prediction channel (never staked),
// so a NO selection is recorded + settled analytically only — zero exposure.
//
// Calibration method (2026-06-30, per-league sweep via /backtest/tuning
// bttsNoReports): NO has NO validated cross-season edge — the per-season sweep
// shows no league holding positive ROI at a stable threshold (I2 single-season,
// L1/SA flip to FAIL in 2024-25), and the model's P(NO) carries no lift over the
// league base rate (at volume thresholds hit rate ≈ base rate). So segments are
// NOT chosen by ROI (that would bake in 2025-26 variance). Instead, structural:
//   • eligible = leagues where NO is a genuine co-viable outcome (empirical
//     no-BTTS base rate ≥ 0.46) AND the model produces real volume (≥ 15 NO
//     candidates / year at the threshold) — high-scoring leagues stay disabled,
//   • threshold = 0.58 for defensive leagues (base ≥ 0.50), 0.55 for the
//     near-even ones — a mild conviction gate, not an ROI-fit.
// This accumulates clean forward NO data per defensive league. Promote a segment
// to staking ONLY if a real cross-season edge emerges after the model gains a NO
// signal (the per-league model recalibration is the actual blocker). Re-run the
// sweep each season; reopen via the endpoint already in place.
export type BttsNoLeagueConfig = { enabled: boolean; threshold: number };

const BTTS_NO_DEFAULT: BttsNoLeagueConfig = { enabled: false, threshold: 0.65 };

export const BTTS_NO_CONFIG: Record<string, BttsNoLeagueConfig> = {
  // base no-BTTS ≥ 0.50 (defensive) → threshold 0.58
  SA: { enabled: true, threshold: 0.58 }, // base 0.50, n~25/yr, hit 56%
  BRA1: { enabled: true, threshold: 0.58 }, // base 0.50, n~19/yr
  FRI: { enabled: true, threshold: 0.58 }, // base 0.50, n~40/yr, hit 55%
  // base 0.46–0.48 (near-even) → threshold 0.55
  EL1: { enabled: true, threshold: 0.55 }, // base 0.48, n~16/yr
  CH: { enabled: true, threshold: 0.55 }, // base 0.47, n~72/yr
  EL2: { enabled: true, threshold: 0.55 }, // base 0.47, n~26/yr
  LL: { enabled: true, threshold: 0.55 }, // base 0.47, n~40/yr, hit 55%
};

// Resolve the BTTS NO config for a league (disabled default when not listed).
export function getBttsNoConfig(
  competitionCode: string | null | undefined,
): BttsNoLeagueConfig {
  if (competitionCode == null) return BTTS_NO_DEFAULT;
  return BTTS_NO_CONFIG[competitionCode] ?? BTTS_NO_DEFAULT;
}

export const CHANNEL_STRATEGY_CONFIG_CHANNELS: ChannelStrategyConfigChannel[] =
  ["DOMINANT", "DRAW", "BTTS"];

export const CHANNEL_STRATEGY_CONFIG: Record<string, ChannelStrategyConfigMap> =
  {
    BL1: {
      // BL1 backtest 2026-04-19: 0.50 keeps validation while materially
      // improving coverage versus 0.60 (40.7% vs 14.1%).
      // Tuning 2026-06-24 (1y): 0.50 → 0.55 (ROI +4.3%, n=76, cov 31%).
      DOMINANT: { enabled: true, threshold: 0.55, minSampleN: 10 },
      // BL1 backtest 2026-05-05: strongest DRAW signal after I2. All 3 seasons
      // PASS: 2023-24 +17.8%, 2024-25 +14.1%, 2025-26 +33.4%. Aggregate
      // (186 picks, ~62/s): HR 35.5%, ROI +21.4%. threshold 0.28 = 1/3.57.
      DRAW: { enabled: true, threshold: 0.28, minSampleN: 10 },
      // BL1 backtest 2026-05-03: 0.56 covered 83% of fixtures — too broad.
      // 0.60 keeps 65% hit rate with 45% coverage, a meaningful selector.
      // Tuning 2026-06-24 (1y): 0.60 → 0.62 (ROI +2.1%, n=93, cov 31%).
      BTTS: { enabled: true, threshold: 0.62, minSampleN: 10 },
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
      // Tuning 2026-06-24 (1y): enable at 0.30 (ROI +5.9%, n=52, cov 14%).
      DRAW: { enabled: true, threshold: 0.3, minSampleN: 10 },
      // PL backtest 2026-05-03: 0.58 improves hit rate to 64.1% (vs 60.6% at
      // 0.55) while keeping 36% coverage — cleaner signal on a high-volume ligue.
      // Tuning 2026-06-24 (1y): 0.58 → 0.52 (ROI +0.8%, n=276, cov 75%).
      BTTS: { enabled: true, threshold: 0.52, minSampleN: 10 },
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
      // Tuning 2026-06-24 (1y): 0.50 → 0.55 (ROI +1.5%, n=97, cov 36%).
      DOMINANT: { enabled: true, threshold: 0.55, minSampleN: 10 },
      // POR backtest 2026-05-05: 1/drawOdds signal validates where Poisson failed.
      // 2/3 seasons PASS: 2023-24 +37.0%, 2024-25 +0.9% (borderline), 2025-26 +8.9%.
      // Aggregate (257 picks, ~86/s): HR 35.8%, ROI +12.7%. threshold 0.30 = 1/3.33.
      // Tuning 2026-06-24 (1y): 0.30 → 0.26 (ROI +13.9%, n=179, cov 60%).
      DRAW: { enabled: true, threshold: 0.26, minSampleN: 10 },
    },
    LL: {
      // LL backtest 2026-04-19: 0.50 keeps validation while materially
      // expanding coverage versus 0.60.
      DOMINANT: { enabled: true, threshold: 0.5, minSampleN: 20 },
      // LL backtest 2026-05-03: 0.57 produced only 58 picks (6.2% coverage, FAIL).
      // 0.55 keeps the same 62.1% hit rate with 158 picks and 17% coverage (PASS).
      // Tuning 2026-06-24 (1y): 0.55 → 0.50 (ROI +7.2%, n=246, cov 67%).
      BTTS: { enabled: true, threshold: 0.5, minSampleN: 10 },
    },
    F2: {
      // F2 backtest 2026-05-03: 0.55 validates at 58% hit rate on 112 picks
      // (13.4% coverage). Narrow window — 0.50 and 0.60 both fail. minSampleN
      // raised to 15 for robustness given the single-threshold pass.
      DOMINANT: { enabled: true, threshold: 0.55, minSampleN: 15 },
      // Tuning 2026-06-24 (1y): enable DRAW at 0.32 (ROI +15.0%, n=84, cov 28%).
      DRAW: { enabled: true, threshold: 0.32, minSampleN: 10 },
      // Tuning 2026-06-24 (1y): enable BTTS at 0.50 (ROI +1.4%, n=54, cov 93%).
      BTTS: { enabled: true, threshold: 0.5, minSampleN: 10 },
    },
    I2: {
      // I2 backtest 2026-04-19: no tested threshold clears the hit-rate floor.
      DOMINANT: { enabled: false, threshold: 0.55, minSampleN: 10 },
      // I2 backtest 2026-05-05: strongest DRAW signal in the panel.
      // Aggregate 3 seasons (672 picks): HR 36.3%, ROI +11.1% at 0.30.
      // Consistent: 2023-24 +16.4%, 2024-25 +12.3%, 2025-26 +6.5%.
      // threshold 0.30 = 1/3.33 → selects drawOdds < 3.33.
      // Tuning 2026-06-24 (1y): 0.30 → 0.26 (ROI +9.6%, n=335, cov 88%).
      DRAW: { enabled: true, threshold: 0.26, minSampleN: 10 },
    },
    ERD: {
      // Tuning 2026-06-24 (1y): no viable threshold (ROI -10.1%, n=143 at 0.50)
      // → suspend pending recalibration.
      DOMINANT: { enabled: false, threshold: 0.5, minSampleN: 10 },
      BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
    },
    WC: {
      // WC recalibration 2026-07-01 on WC 2026 forward data (group stage + 7 R32 =
      // 79 fixtures played; WC 2022 produced no settled picks — no odds imported —
      // so this is single-tournament, in-progress: only structural + data-confirmed
      // moves, no ROI-fit to variance).
      // DOMINANT: 0.60 is break-even in the 48-team format (33 picks 66.7% HR, ROI
      // -0.7%); 0.65 drops the weak 0.60-0.65 band (4W/5L) → 24 picks 75.0% HR,
      // +10.7% ROI. Raise to 0.65 — consistent with every WCQ config (the expanded
      // 48-team format is more competitive, so DOMINANT needs a higher bar).
      DOMINANT: { enabled: true, threshold: 0.65, minSampleN: 10 },
      // DRAW (staked): observation-derived but profitable — 31 picks 38.7% HR at avg
      // odds 3.38, +8.45u (+27% ROI). The model rarely prices draws ≥0.28 (only 12
      // picks) and raising the gate collapses it; 0.25 = drawOdds < 4.00 captures the
      // signal. Kept unchanged (raised 0.20 → 0.25 on 2026-06-14).
      DRAW: { enabled: true, threshold: 0.25, minSampleN: 5 },
      // BTTS (observation only): 0.35 was an explicit data-collection placeholder
      // ("will fire on ~58% of fixtures ... data collection only"). Forward data now
      // supports a real conviction gate: at 0.50, 40 picks 62.5% HR (+21.9% ROI),
      // stable across 0.45-0.55. Promote 0.35 → 0.50 so the channel emits a genuine
      // signal instead of noise. minSampleN raised 5 → 10 now that volume exists.
      BTTS: { enabled: true, threshold: 0.5, minSampleN: 10 },
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
      // Tuning 2026-06-24 (1y): 0.58 → 0.60 (ROI +2.3%, n=64, cov 12%).
      BTTS: { enabled: true, threshold: 0.6, minSampleN: 15 },
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
      // L1 backtest 2026-05-03: low-BTTS league, 0.58 was the lowest valid
      // threshold (55.4%, 157 picks). Fragile — minSampleN raised to 15.
      // Tuning 2026-06-24 (1y): no viable threshold (ROI -12.2%, n=73 at 0.58)
      // → suspend pending recalibration.
      BTTS: { enabled: false, threshold: 0.58, minSampleN: 15 },
      // Tuning 2026-06-24 (1y): enable DRAW at 0.28 (ROI +12.9%, n=107, cov 36%).
      DRAW: { enabled: true, threshold: 0.28, minSampleN: 10 },
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
      // Tuning 2026-06-24 (1y): enable DRAW at 0.26 (ROI +38.9%, n=79, cov 51%).
      DRAW: { enabled: true, threshold: 0.26, minSampleN: 10 },
    },
    SA: {
      // SA backtest 2026-05-03: DOMINANT activated at 0.50 (65.4% hit rate, 335 picks).
      // Tuning 2026-06-24 (1y): no viable threshold (ROI -8.1%, n=122 at 0.50)
      // → suspend pending recalibration.
      DOMINANT: { enabled: false, threshold: 0.5, minSampleN: 10 },
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
      // UEL backtest 2026-05-03: DOMINANT validated only at 0.65 (57.6%, 10% coverage, 66 picks).
      // Tuning 2026-06-24 (1y): 0.65 → 0.45 (ROI +11.6%, n=79, cov 64%) — broader, stronger window.
      DOMINANT: { enabled: true, threshold: 0.45, minSampleN: 20 },
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
      // UCL backtest 2026-05-03: DOMINANT validated cleanly at 0.55 (59.7%, 28.1% coverage, 159 picks).
      // Tuning 2026-06-24 (1y): 0.55 → 0.45 (ROI +18.7%, n=53, cov 68%).
      DOMINANT: { enabled: true, threshold: 0.45, minSampleN: 10 },
      // UCL backtest 2026-05-03: BTTS validates at 0.60 (58.7%, 22.3% coverage, 126 picks).
      BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
    },
    J1: {
      // J1 backtest 2026-05-03: DOMINANT never cleared 50% hit rate floor.
      // Tuning 2026-06-24 (1y): DOMINANT validates at 0.45 (ROI +10.3%, n=124, cov 59%).
      DOMINANT: { enabled: true, threshold: 0.45, minSampleN: 10 },
      // J1 backtest 2026-05-03: BTTS validates at 0.58 (56%, 26.9% coverage,
      // 268 picks) — best balance for the league.
      BTTS: { enabled: true, threshold: 0.58, minSampleN: 10 },
    },
    POL1: {
      // POL1 backtest 2026-05-03: DOMINANT no PASS. BTTS validates progressively;
      // 0.58 gives 62.6% hr with 16.8% coverage (123 picks) — better precision than 0.50.
      BTTS: { enabled: true, threshold: 0.58, minSampleN: 10 },
      // Tuning 2026-06-24 (1y): enable DRAW at 0.30 (ROI +9.4%, n=61, cov 24%).
      DRAW: { enabled: true, threshold: 0.3, minSampleN: 10 },
    },
    SUI1: {
      // SUI1 backtest 2026-05-03: DOMINANT validates only at 0.60 (55.4%, 14.8%, 83 picks).
      // Fragile single-window — minSampleN raised to 15.
      DOMINANT: { enabled: true, threshold: 0.6, minSampleN: 15 },
      // SUI1 backtest 2026-05-03: BTTS 0.60 gives 60.6% hr with 22.6% coverage (127 picks).
      BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
      // Result-derived 2026-07-09 (no DRAW backtest run 2026-05-03): weak
      // signal, 0.26 gives the best available balance (26.7% HR, n=131/667,
      // cov 20%). Enabled to observe rather than left at the disabled default.
      DRAW: { enabled: true, threshold: 0.26, minSampleN: 15 },
    },
    TUR1: {
      // TUR1 backtest 2026-05-03: DOMINANT strong progressive signal — 0.55 gives 67.5% hr
      // with 29.6% coverage (252 picks). Clear favourite league.
      // Tuning 2026-06-24 (1y): 0.55 → 0.60 (ROI +6.5%, n=54, cov 30%) — tighter, cleaner.
      // Tuning 2026-07-09 (post-rebuild, real priced odds): 0.60 → 0.70
      // (ROI +13.3%, n=77, cov 11%) — tighter still, cleaner ROI.
      DOMINANT: { enabled: true, threshold: 0.7, minSampleN: 10 },
      // Tuning 2026-07-09 (post-rebuild, real priced odds): 0.28 validates
      // (ROI +8.6%, n=363, cov 45%) — supersedes the 2026-07-09 result-only
      // estimate (same threshold, now confirmed by real ROI with 6x the sample).
      DRAW: { enabled: true, threshold: 0.28, minSampleN: 10 },
      // BTTS 0.52 gives 56.5% HR (n=609/997, cov 61%) — strong volume+HR.
      BTTS: { enabled: true, threshold: 0.52, minSampleN: 10 },
    },
    TUR2: {
      // TUR2 backtest 2026-05-03: DOMINANT extraordinarily strong — 0.60 gives 73.9% hr with
      // 23.3% coverage (211 picks). Chosen over 0.65/0.70 for robustness.
      DOMINANT: { enabled: true, threshold: 0.6, minSampleN: 10 },
      // Result-derived 2026-07-09 (no DRAW/BTTS backtest run 2026-05-03):
      // DRAW 0.26 gives 30.2% HR (n=424/1052, cov 40%) — good coverage+HR.
      DRAW: { enabled: true, threshold: 0.26, minSampleN: 10 },
      // BTTS weaker than DOMINANT here — 0.58 gives 56.1% HR (n=66/1052,
      // cov 6.3%). Thin — minSampleN raised to 15.
      BTTS: { enabled: true, threshold: 0.58, minSampleN: 15 },
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
      // Result-derived 2026-07-09 (2026-05-03 backtest found no PASS threshold
      // for DOMINANT — but that was ROI-gated on thin priced odds; DOMINANT
      // settles on the match result alone). 0.65 gives 60.9% HR (n=92/751,
      // cov 12%). Enabled to observe rather than left disabled.
      DOMINANT: { enabled: true, threshold: 0.65, minSampleN: 15 },
      // SWE2 backtest 2026-05-03: BTTS marginal at 0.55 (56.2%, 32%, 192 picks)
      // — passes criteria, monitor closely.
      BTTS: { enabled: true, threshold: 0.55, minSampleN: 10 },
      // Result-derived 2026-07-09 (no DRAW backtest run 2026-05-03): 0.24
      // gives 26.9% HR (n=372/751, cov 50%) — best coverage available.
      DRAW: { enabled: true, threshold: 0.24, minSampleN: 10 },
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
      // Tuning 2026-06-24 (1y): 0.55 → 0.45 (ROI +16.4%, n=73, cov 76%) — more volume, stronger ROI.
      DOMINANT: { enabled: true, threshold: 0.45, minSampleN: 10 },
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
      // NOR1 backtest 2026-05-03: DOMINANT validated at 0.55 (61%, 34.7%, 205 picks).
      // Tuning 2026-06-24 (1y): no viable threshold (ROI -17.7%, n=61 at 0.55)
      // → suspend pending recalibration.
      DOMINANT: { enabled: false, threshold: 0.55, minSampleN: 10 },
      // NOR1 backtest 2026-05-03: BTTS 0.62 gives 67.1% hr with 11.8% coverage (70 picks).
      BTTS: { enabled: true, threshold: 0.62, minSampleN: 10 },
    },
    CZE1: {
      // CZE1 backtest 2026-05-03: DOMINANT strong at 0.55 (65.4%, 34.4%, 228 picks).
      DOMINANT: { enabled: true, threshold: 0.55, minSampleN: 10 },
      // CZE1 backtest 2026-05-03: BTTS validates only at 0.50 and 0.52; above 0.55 FAIL.
      // 0.52 preferred for selectivity (56%, 38% coverage, 252 picks).
      BTTS: { enabled: true, threshold: 0.52, minSampleN: 10 },
      // Result-derived 2026-07-09 (no DRAW backtest run 2026-05-03): 0.26
      // gives 29.4% HR (n=265/789, cov 34%).
      DRAW: { enabled: true, threshold: 0.26, minSampleN: 10 },
    },
    SRB1: {
      // SRB1 backtest 2026-05-03: DOMINANT validates at 0.55 (63.1%, 30.3%, 217 picks).
      DOMINANT: { enabled: true, threshold: 0.55, minSampleN: 10 },
      // SRB1 backtest 2026-05-03: BTTS 0.58 gives 57.8% hr with 12.6% coverage (90 picks).
      BTTS: { enabled: true, threshold: 0.58, minSampleN: 10 },
      // Result-derived 2026-07-09 (no DRAW backtest run 2026-05-03): 0.26
      // gives 27.0% HR (n=278/863, cov 32%).
      DRAW: { enabled: true, threshold: 0.26, minSampleN: 10 },
    },
    // First calibration for the leagues below (added 2026-07, no prior config
    // entry). Tuning 2026-07-09 read from /backtest/tuning (real priced odds,
    // not the settled-selection total — see channel-backtest.service.ts fix).
    //
    // DOMINANT/DRAW/BTTS never require a priced odds snapshot to settle (the
    // fixture result alone tells us won/lost) — so a segment with no proven
    // ROI edge is enabled anyway at its best hit-rate threshold, not disabled.
    // Disabling would stop selection generation entirely (see
    // dominant.strategy.ts / draw.strategy.ts / btts.strategy.ts:
    // `!config.enabled` short-circuits before any pick is emitted), which means
    // zero forward data to recalibrate from tomorrow. Thresholds below marked
    // "HR-only, ROI unproven" are picked from the raw hit-rate sweep (not gated
    // on the thin priced-odds ROI) — same observation-first logic as
    // GOALS_CONFIG/CORRECT_SCORE_CONFIG below.
    //
    // BTTS specifically: the BTTS bookmaker market has ~0 priced fixtures
    // across all 11 leagues (0-3 out of 585-1521), so /backtest/tuning cannot
    // sweep it at all (its BTTS candidates require priced BTTS odds, unlike
    // DOMINANT/DRAW). Thresholds below are computed directly from
    // model_run.features.probabilities.bttsYes vs the actual "both scored"
    // result — no odds involved, same reasoning as DOMINANT/DRAW above.
    ARG1: {
      // Tuning 2026-07-09: HR-only, ROI unproven — 0.65 gives 51.1% HR
      // (n=94/1227, cov 7.7%, ROI +8.6% on the thin priced subset).
      DOMINANT: { enabled: true, threshold: 0.65, minSampleN: 15 },
      // Tuning 2026-07-09: 0.30 gives 34.8% HR (n=1147/1463, cov 78%,
      // ROI +3.8% on the thin priced subset).
      DRAW: { enabled: true, threshold: 0.3, minSampleN: 10 },
      // Result-derived 2026-07-09 (no priced BTTS odds): base BTTS-yes rate
      // 0.40 (low-scoring league). 0.50 gives 40.8% HR (n=120/1463, cov 8.2%)
      // — barely above base rate, weak signal. Enabled to observe.
      BTTS: { enabled: true, threshold: 0.5, minSampleN: 15 },
    },
    AUT1: {
      // Tuning 2026-07-09: HR-only, ROI unproven — 0.65 gives 56.5% HR
      // (n=69/501, cov 14%, ROI -9.8% on the thin priced subset). Enabled to
      // observe; HR climbs with threshold while ROI stays flat-negative,
      // suggesting the priced subset (not the model) is the noisy part.
      DOMINANT: { enabled: true, threshold: 0.65, minSampleN: 15 },
      // Tuning 2026-07-09: DRAW validates at 0.32 (ROI +25.3%, n=41, cov 7.2%).
      // Thin single-window sample — minSampleN raised to 15.
      DRAW: { enabled: true, threshold: 0.32, minSampleN: 15 },
      // Result-derived 2026-07-09 (no priced BTTS odds): 0.58 gives 53.1% HR
      // (n=49/567, cov 8.6%). Thin — minSampleN raised to 15.
      BTTS: { enabled: true, threshold: 0.58, minSampleN: 15 },
    },
    BEL1: {
      // Tuning 2026-07-09: DOMINANT validates at 0.65 (ROI +1.3%, n=110, cov 14%).
      DOMINANT: { enabled: true, threshold: 0.65, minSampleN: 10 },
      // Tuning 2026-07-09: DRAW validates at 0.32 (ROI +65.2%, n=26, cov 2.9%).
      // Very thin sample — minSampleN raised to 15, monitor closely.
      DRAW: { enabled: true, threshold: 0.32, minSampleN: 15 },
      // Result-derived 2026-07-09 (no priced BTTS odds): 0.55 gives 61.9% HR
      // (n=236/923, cov 26%) — solid coverage and hit rate.
      BTTS: { enabled: true, threshold: 0.55, minSampleN: 10 },
    },
    BRA2: {
      // Tuning 2026-07-09: DOMINANT validates strongly at 0.6 (ROI +25.7%,
      // n=131, cov 12%).
      DOMINANT: { enabled: true, threshold: 0.6, minSampleN: 10 },
      // Tuning 2026-07-09: HR-only, ROI unproven — ROI negative at every
      // threshold on the thin priced subset, but 0.30 is the least-bad point
      // with real coverage (30.0% HR, n=869/1248, cov 70%). Enabled to
      // observe; ROI signal here (not just thin sampling) may confirm a real
      // DRAW weakness in this league once forward data accumulates.
      DRAW: { enabled: true, threshold: 0.3, minSampleN: 15 },
      // Result-derived 2026-07-09 (no priced BTTS odds): weak signal overall
      // (base rate 0.45); 0.52 gives 49.5% HR (n=105/1283, cov 8.3%). Thin —
      // minSampleN raised to 15, monitor closely.
      BTTS: { enabled: true, threshold: 0.52, minSampleN: 15 },
    },
    CHI1: {
      // Tuning 2026-07-09: DOMINANT validates at 0.65 (ROI +11.4%, n=54, cov 10%).
      DOMINANT: { enabled: true, threshold: 0.65, minSampleN: 10 },
      // Tuning 2026-07-09: HR-only, ROI unproven — ROI negative at every
      // threshold on the thin priced subset; 0.30 is the least-bad point with
      // usable coverage (26.8% HR, n=127/607, cov 21%). Enabled to observe.
      DRAW: { enabled: true, threshold: 0.3, minSampleN: 15 },
      // Result-derived 2026-07-09 (no priced BTTS odds): 0.55 gives 57.6% HR
      // (n=205/805, cov 25.5%) — good coverage and hit rate.
      BTTS: { enabled: true, threshold: 0.55, minSampleN: 10 },
    },
    DEN1: {
      // Tuning 2026-07-09: DOMINANT validates at 0.75 (ROI +12.6%, n=25, cov 5%).
      // Thin single-window sample — minSampleN raised to 15.
      DOMINANT: { enabled: true, threshold: 0.75, minSampleN: 15 },
      // Tuning 2026-07-09: DRAW validates at 0.3 (ROI +11.3%, n=40, cov 7.1%).
      DRAW: { enabled: true, threshold: 0.3, minSampleN: 15 },
      // Result-derived 2026-07-09 (no priced BTTS odds): highest-scoring
      // league in this batch (base rate 0.61). 0.6 gives 65.4% HR (n=104/561,
      // cov 18.5%).
      BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
    },
    GRE1: {
      // Tuning 2026-07-09: HR-only, ROI unproven — hit rate climbs cleanly
      // with threshold (53.9% → 75.5% from 0.45 to 0.75) but ROI stays
      // negative throughout on the thin priced subset. 0.65 balances HR
      // (68.3%) against coverage (n=120/614, 19.5%). Enabled to observe —
      // the consistent negative ROI is itself a signal worth tracking
      // forward, not a reason to go dark on this league.
      DOMINANT: { enabled: true, threshold: 0.65, minSampleN: 15 },
      // Tuning 2026-07-09: 0.26 gives the best ROI on the priced subset
      // (32.0% HR, n=412/674, cov 61%, ROI +3.6%).
      DRAW: { enabled: true, threshold: 0.26, minSampleN: 10 },
      // Result-derived 2026-07-09 (no priced BTTS odds): 0.58 gives 58.7% HR
      // (n=46/688, cov 6.7%). Thin — minSampleN raised to 15.
      BTTS: { enabled: true, threshold: 0.58, minSampleN: 15 },
    },
    IRL1: {
      // Tuning 2026-07-09: HR-only, ROI unproven — 0.65 gives 62.7% HR
      // (n=67/568, cov 12%, ROI -9.2% on the thin priced subset). Enabled to
      // observe; HR climbs cleanly with threshold (51% → 68.4%) while ROI
      // stays flat-negative, suggesting the priced subset (not the model
      // ranking) is the noisy part.
      DOMINANT: { enabled: true, threshold: 0.65, minSampleN: 15 },
      // Tuning 2026-07-09: DRAW validates at 0.32 (ROI +11.8%, n=92, cov 15%).
      DRAW: { enabled: true, threshold: 0.32, minSampleN: 10 },
      // Result-derived 2026-07-09 (no priced BTTS odds): 0.55 gives 52.1% HR
      // (n=73/648, cov 11.5%). Modest — minSampleN raised to 15.
      BTTS: { enabled: true, threshold: 0.55, minSampleN: 15 },
    },
    KSA1: {
      // Tuning 2026-07-09: DOMINANT validates at 0.65 (100% hit rate, ROI
      // +24.7%, n=24, cov 35%). Very thin sample (68 candidates total) —
      // minSampleN raised to 20, monitor closely before trusting the 100% HR.
      DOMINANT: { enabled: true, threshold: 0.65, minSampleN: 20 },
      // Tuning 2026-07-09: DRAW validates at 0.26 (ROI +12.0%, n=22/76,
      // cov 29%). Thin — minSampleN raised to 15.
      DRAW: { enabled: true, threshold: 0.26, minSampleN: 15 },
      // Result-derived 2026-07-09 (no priced BTTS odds): 0.6 gives 61.3% HR
      // (n=93/891, cov 10.4%).
      BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
    },
    RUS1: {
      // Tuning 2026-07-09: DOMINANT validates at 0.65 (ROI +5.2%, n=33, cov 18%).
      // Marginal ROI over a thin sample — minSampleN raised to 15.
      DOMINANT: { enabled: true, threshold: 0.65, minSampleN: 15 },
      // Tuning 2026-07-09: DRAW validates at 0.28 (ROI +13.6%, n=79, cov 39%).
      DRAW: { enabled: true, threshold: 0.28, minSampleN: 10 },
      // Result-derived 2026-07-09 (no priced BTTS odds): 0.55 gives 64.2% HR
      // (n=137/702, cov 19.5%) — solid.
      BTTS: { enabled: true, threshold: 0.55, minSampleN: 10 },
    },
    SCO1: {
      // Tuning 2026-07-09: DOMINANT validates at 0.7 (ROI +10.5%, n=80, cov 13%).
      DOMINANT: { enabled: true, threshold: 0.7, minSampleN: 10 },
      // Tuning 2026-07-09: DRAW validates at 0.28 (ROI +1.7%, n=289, cov 43%).
      DRAW: { enabled: true, threshold: 0.28, minSampleN: 10 },
      // Result-derived 2026-07-09 (no priced BTTS odds): 0.58 gives 64.6% HR
      // (n=96/678, cov 14.2%) — best balance of HR and coverage (0.6 gives
      // 74% but drops to n=50).
      BTTS: { enabled: true, threshold: 0.58, minSampleN: 10 },
    },
    // Second batch (added 2026-07-09): leagues that had a GOALS_CONFIG entry
    // but zero CHANNEL_STRATEGY_CONFIG entry (NOR2/EST1/LAT1/POL2/ISL1/SVN1),
    // and leagues never calibrated at all (ARG2/CHI2/CHN2/KOR2/USA2/FIN2/SUI2
    // — 0% 1X2 odds coverage, no Odds API sport key configured, but
    // model_run exists from the betting-engine rebuild so result-derived
    // calibration is still possible). Same result-only method as above: no
    // priced odds required for DOMINANT/DRAW/BTTS to settle.
    NOR2: {
      // Tuning 2026-07-09 (post-rebuild, real priced odds): 0.5 validates
      // (ROI +30.1%, n=37, cov 73%) — supersedes the 2026-07-09 result-only
      // estimate (0.65) now that real ROI data exists.
      DOMINANT: { enabled: true, threshold: 0.5, minSampleN: 10 },
      // Weak signal across the board — 0.24 is the best-covered point
      // (21.8% HR, n=165/779, cov 21%). Monitor closely.
      DRAW: { enabled: true, threshold: 0.24, minSampleN: 15 },
      // 0.6 gives 62.6% HR (n=423/779, cov 54%) — high-BTTS league.
      BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
    },
    EST1: {
      // Result-derived 2026-07-09: 0.65 gives 74.5% HR (n=149/527, cov 28%) — excellent.
      DOMINANT: { enabled: true, threshold: 0.65, minSampleN: 10 },
      // Weak signal — 0.24 is the best-covered point (22.7% HR, n=225/527,
      // cov 43%). Monitor closely.
      DRAW: { enabled: true, threshold: 0.24, minSampleN: 15 },
      // 0.5 gives 54.9% HR (n=266/527, cov 50%).
      BTTS: { enabled: true, threshold: 0.5, minSampleN: 10 },
    },
    LAT1: {
      // Result-derived 2026-07-09: 0.65 gives 77.7% HR (n=197/560, cov 35%) — excellent.
      DOMINANT: { enabled: true, threshold: 0.65, minSampleN: 10 },
      // 0.24 gives 31.0% HR (n=245/560, cov 44%) — best coverage available.
      DRAW: { enabled: true, threshold: 0.24, minSampleN: 10 },
      // 0.55 gives 59.7% HR (n=119/560, cov 21%).
      BTTS: { enabled: true, threshold: 0.55, minSampleN: 10 },
    },
    POL2: {
      // Result-derived 2026-07-09: 0.6 gives 57.7% HR (n=213/897, cov 24%).
      DOMINANT: { enabled: true, threshold: 0.6, minSampleN: 10 },
      // 0.24 gives 26.5% HR (n=536/897, cov 60%).
      DRAW: { enabled: true, threshold: 0.24, minSampleN: 10 },
      // 0.55 gives 62.5% HR (n=240/897, cov 27%).
      BTTS: { enabled: true, threshold: 0.55, minSampleN: 10 },
    },
    ISL1: {
      // Result-derived 2026-07-09: 0.65 gives 65.7% HR (n=108/497, cov 22%).
      DOMINANT: { enabled: true, threshold: 0.65, minSampleN: 10 },
      // Thin/noisy — 0.24 is the best-covered point (31.3% HR, n=64/497,
      // cov 13%). Monitor closely.
      DRAW: { enabled: true, threshold: 0.24, minSampleN: 15 },
      // Very high-BTTS league (base rate ~67%+). 0.58 gives 69.0% HR
      // (n=348/497, cov 70%) — strong balance of HR and coverage.
      BTTS: { enabled: true, threshold: 0.58, minSampleN: 10 },
    },
    SVN1: {
      // Result-derived 2026-07-09: 0.65 gives 66.3% HR (n=104/504, cov 21%).
      DOMINANT: { enabled: true, threshold: 0.65, minSampleN: 10 },
      // 0.26 gives 32.6% HR (n=89/504, cov 18%).
      DRAW: { enabled: true, threshold: 0.26, minSampleN: 10 },
      // 0.58 gives 58.3% HR (n=96/504, cov 19%).
      BTTS: { enabled: true, threshold: 0.58, minSampleN: 10 },
    },
    ARG2: {
      // Result-derived 2026-07-09: low-scoring, tight league. 0.55 gives
      // 50.3% HR (n=322/2314, cov 14%) — modest signal, above the 33%
      // 3-outcome baseline. Monitor closely.
      DOMINANT: { enabled: true, threshold: 0.55, minSampleN: 15 },
      // 0.28 gives 33.6% HR (n=1534/2314, cov 66%) — good coverage.
      DRAW: { enabled: true, threshold: 0.28, minSampleN: 10 },
      // Weak BTTS signal (low-scoring league) — 0.52 gives 57.6% HR
      // (n=66/2314, cov 2.9%). Thin — minSampleN raised to 15.
      BTTS: { enabled: true, threshold: 0.52, minSampleN: 15 },
    },
    CHI2: {
      // Result-derived 2026-07-09: 0.65 gives 56.9% HR (n=65/569, cov 11%).
      DOMINANT: { enabled: true, threshold: 0.65, minSampleN: 15 },
      // 0.30 spikes to 41.5% HR but is thin (n=41/569, cov 7%) — used anyway,
      // minSampleN raised to 15 to gate it further.
      DRAW: { enabled: true, threshold: 0.3, minSampleN: 15 },
      // 0.5 gives 52.2% HR (n=255/569, cov 45%) — good coverage.
      BTTS: { enabled: true, threshold: 0.5, minSampleN: 10 },
    },
    CHN2: {
      // Result-derived 2026-07-09: 0.6 gives 58.4% HR (n=149/791, cov 19%).
      DOMINANT: { enabled: true, threshold: 0.6, minSampleN: 10 },
      // 0.28 gives 35.5% HR (n=234/791, cov 30%).
      DRAW: { enabled: true, threshold: 0.28, minSampleN: 10 },
      // 0.52 gives 60.9% HR (n=179/791, cov 23%).
      BTTS: { enabled: true, threshold: 0.52, minSampleN: 10 },
    },
    KOR2: {
      // Result-derived 2026-07-09: 0.6 gives 54.7% HR (n=139/845, cov 16%).
      DOMINANT: { enabled: true, threshold: 0.6, minSampleN: 10 },
      // 0.26 gives 31.5% HR (n=321/845, cov 38%).
      DRAW: { enabled: true, threshold: 0.26, minSampleN: 10 },
      // 0.55 gives 56.6% HR (n=182/845, cov 22%).
      BTTS: { enabled: true, threshold: 0.55, minSampleN: 10 },
    },
    USA2: {
      // Result-derived 2026-07-09: weak signal — 0.65 gives 53.6% HR
      // (n=125/1338, cov 9%). Monitor closely.
      DOMINANT: { enabled: true, threshold: 0.65, minSampleN: 15 },
      // Weak signal across the board — 0.24 is the best-covered point
      // (25.5% HR, n=846/1338, cov 63%). Monitor closely.
      DRAW: { enabled: true, threshold: 0.24, minSampleN: 15 },
      // 0.58 gives 55.6% HR (n=169/1338, cov 13%).
      BTTS: { enabled: true, threshold: 0.58, minSampleN: 10 },
    },
    FIN2: {
      // Result-derived 2026-07-09: 0.6 gives 58.6% HR (n=99/320, cov 31%).
      DOMINANT: { enabled: true, threshold: 0.6, minSampleN: 10 },
      // Weak signal — 0.24 is the best-covered point (23.9% HR, n=138/320,
      // cov 43%). Monitor closely.
      DRAW: { enabled: true, threshold: 0.24, minSampleN: 15 },
      // 0.58 gives 69.9% HR (n=103/320, cov 32%) — excellent.
      BTTS: { enabled: true, threshold: 0.58, minSampleN: 10 },
    },
    SUI2: {
      // Result-derived 2026-07-09: 0.65 gives 64.7% HR (n=85/522, cov 16%).
      DOMINANT: { enabled: true, threshold: 0.65, minSampleN: 15 },
      // 0.24 gives 29.1% HR (n=141/522, cov 27%) — best coverage available.
      DRAW: { enabled: true, threshold: 0.24, minSampleN: 10 },
      // High-BTTS league (base rate ~87% coverage at 0.5). 0.6 gives 58.8% HR
      // (n=216/522, cov 41%) — good balance.
      BTTS: { enabled: true, threshold: 0.6, minSampleN: 10 },
    },
  };

// ─────────────────────────────────────────────
// GOALS channel (Over/Under) — separate shape: the line dimension makes the
// calibration unit (league × line × side), not the league alone. Each
// (line, side) lives on its own probability scale (P(Over 1.5) ≈ 0.85 vs
// P(Over 4.5) ≈ 0.10), so a single per-league threshold is meaningless.
// Promotion is ROI-driven (see tuning.constants.ts), not hit-rate driven.
//
// Historical odds only cover the 2.5 line (the-odds-api backfill imports the
// main line only); the 1.5/3.5/4.5 lines exist solely from the API-Football
// PREMATCH sync, which accumulates forward. Decision 2026-06-24: stop waiting
// on a historical densify and instead OBSERVE forward on the lines we already
// price prematch — see the GOALS_CONFIG header below.
// ─────────────────────────────────────────────

export type GoalsLine = 1.5 | 2.5 | 3.5 | 4.5;
export type GoalsSide = "OVER" | "UNDER";

export type GoalsLineConfig = {
  line: GoalsLine;
  side: GoalsSide;
  enabled: boolean;
  // Minimum model probability for the side to qualify on this line.
  threshold: number;
  minSampleN: number;
};

export type GoalsLeagueConfig = {
  lines: readonly GoalsLineConfig[];
};

// GOALS — enabled in OBSERVATION (2026-06-24, contextual per-league broadening).
//
// IMPORTANT: this is NOT a validated staking edge. Multi-season validation on the
// 2.5 line was negative — per-season ROI positive only in the anomalous 2025-26
// season; goal rates and 1X2 calibration are flat across seasons (full analysis in
// git history). GOALS is never staked (only EV/SAFE/DRAW feed the coupon pool), so
// an enabled segment only emits a selection that is recorded + settled analytically
// — visible in the dashboard, accumulating forward data, with zero exposure.
//
// Curation method (per league, contextual): we cannot backtest 1.5/3.5/4.5 (no
// historical odds — they only exist forward via the PREMATCH sync), so segments are
// derived from each league's own goal profile rather than a sweep:
//   • side by profile: OVER when the line's empirical over-rate ≥ 0.55, UNDER when
//     ≤ 0.45, BOTH in the 0.45–0.55 band (the EV ranking then picks the best-priced).
//   • threshold = (empirical base rate of the chosen side) − 0.05 — a conviction
//     gate aligned to each league, loose enough to accumulate volume. The gate only
//     bounds the observed population; EV (prematch odds) does the actual selection.
//   • only lines with real prematch odds coverage (≥ 80 snapshots) are enabled.
// Per-entry comment shows the league's over-rate profile (o15/o25/o35/o45, n).
// Promote a segment to staking ONLY if forward ROI confirms a real edge (and add it
// to the coupon pool — signal-window.getTodayPool — which today excludes GOALS).
// Generated from DB goal-rate × prematch-coverage; re-derive if leagues change.
export const GOALS_CONFIG: Record<string, GoalsLeagueConfig> = {
  // o15 0.61 · o25 0.32 · o35 0.14 · o45 0.06 (n=1521) — low-scoring league.
  // 2.5 UNDER backtest 2026-07-09 (real priced odds): 0.45 validates
  // (ROI +15.3%, n=41, cov 95%) — kept over the profile estimate (0.63)
  // since it is real ROI evidence, not a formula.
  ARG1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.56,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.89,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.58 · o25 0.30 · o35 0.12 · o45 0.04 (n=2388) — very low-scoring
  // league. No 1X2/O-U odds coverage at all (no Odds API sport key) —
  // thresholds are profile estimates only (base − 0.05), observation only.
  ARG2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.53,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.83,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.91,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.76 · o25 0.51 · o35 0.28 · o45 0.13 (n=585)
  // 2.5 UNDER backtest 2026-07-09: 0.65 validates (ROI +10.5%, n=26, cov 7%,
  // thin) — kept over the profile estimate (0.44) as real ROI evidence.
  AUT1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.46,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.67,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.76 · o25 0.52 · o35 0.30 · o45 0.15 (n=951)
  // 2.5 UNDER backtest 2026-07-09: 0.65 validates (ROI +15.3%, n=45, cov 8%)
  // — kept over the profile estimate (0.43) as real ROI evidence.
  BEL1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.47,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.83 · o25 0.62 · o35 0.42 · o45 0.21 (n=924)
  BL1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.78,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.57,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.53,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.72 · o25 0.46 · o35 0.22 · o45 0.10 (n=1159)
  BRA1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.67,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.41,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.49,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.85,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.64 · o25 0.38 · o35 0.17 · o45 0.06 (n=1300) — low-scoring league.
  // No 2.5-line backtest recommendation (554 candidates swept, no PASS) —
  // thresholds below are profile estimates only (base − 0.05), observation only.
  BRA2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.59,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.57,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.78,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.89,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.74 · o25 0.49 · o35 0.25 · o45 0.10 (n=1671)
  CH: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.44,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.46,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.74 · o25 0.53 · o35 0.29 · o45 0.13 (n=840)
  // 2.5 OVER backtest 2026-07-09 (real priced odds): 0.55 validates
  // (ROI +5.6%, n=56, cov 20%) — kept over the profile estimate (0.48).
  CHI1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.55,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.66,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.70 · o25 0.47 · o35 0.26 · o45 0.15 (n=599)
  // No 1X2/O-U odds coverage at all (no Odds API sport key) — thresholds are
  // profile estimates only (base − 0.05), observation only.
  CHI2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.72 · o25 0.44 · o35 0.23 · o45 0.11 (n=823) — low-scoring league.
  // No 1X2/O-U odds coverage at all (no Odds API sport key) — thresholds are
  // profile estimates only (base − 0.05), observation only.
  CHN2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.67,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.51,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.84,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.79 · o25 0.57 · o35 0.38 · o45 0.20 (n=736)
  CSL: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.52,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        // Recalibrated 2026-07-03 on the recent blend (o35 0.45): base−0.05.
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.75 · o25 0.51 · o35 0.29 · o45 0.14 (n=819)
  CZE1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.46,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.44,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.66,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.81 · o25 0.59 · o35 0.35 · o45 0.18 (n=924)
  D2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.76,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.6,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.77,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.82 · o25 0.59 · o35 0.36 · o45 0.20 (n=579)
  // No 2.5-line backtest recommendation (310 candidates swept, no PASS) —
  // thresholds below are profile estimates only (base − 0.05), observation only.
  DEN1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.77,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.59,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.73 · o25 0.50 · o35 0.26 · o45 0.12 (n=1671)
  EL1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.74 · o25 0.50 · o35 0.28 · o45 0.13 (n=1671)
  EL2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.67,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.84 · o25 0.60 · o35 0.39 · o45 0.20 (n=955)
  ERD: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.55,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.56,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.80 · o25 0.57 · o35 0.32 · o45 0.15 (n=566)
  EST1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.52,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        // Recalibrated 2026-07-03 on the recent blend (o35 0.37): base−0.05.
        threshold: 0.58,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.69 · o25 0.47 · o35 0.26 · o45 0.12 (n=999)
  F2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.80 · o25 0.59 · o35 0.33 · o45 0.18 (n=547)
  // Recalibrated 2026-07-03: recent blend (2 last seasons, n=215) o15 0.83 ·
  // o25 0.66 · o35 0.44 · o45 0.26 — the league drifted offensive vs the
  // profile these thresholds were derived from (same failure mode as NOR2).
  // Probabilities are shrunk upstream (probability/ou-shrinkage.ts, factor
  // 0.28); thresholds follow base−0.05 on the recent blend.
  FIN1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.78,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.61,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.51,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.78 · o25 0.58 · o35 0.35 · o45 0.22 (n=338) — high-scoring league.
  // No 1X2/O-U odds coverage at all (no Odds API sport key) — thresholds are
  // profile estimates only (base − 0.05), observation only.
  FIN2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.53,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.6,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.76 · o25 0.53 · o35 0.32 · o45 0.14 (n=343)
  FRI: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.77 · o25 0.52 · o35 0.27 · o45 0.13 (n=712)
  // 2.5 OVER backtest 2026-07-09 (real priced odds): 0.45 validates
  // (ROI +7.6%, n=287, cov 66%) — kept over the profile estimate (0.47).
  GRE1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.43,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.73 · o25 0.48 · o35 0.25 · o45 0.09 (n=1170)
  I2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.43,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.47,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.71 · o25 0.47 · o35 0.25 · o45 0.11 (n=661)
  // No 2.5-line backtest recommendation (468 candidates swept, no PASS) —
  // thresholds below are profile estimates only (base − 0.05), observation only.
  IRL1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.66,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.84,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.86 · o25 0.64 · o35 0.47 · o45 0.29 (n=511)
  ISL1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.59,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "OVER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.66,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.71 · o25 0.47 · o35 0.24 · o45 0.12 (n=1266)
  J1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.66,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.84,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.71 · o25 0.49 · o35 0.28 · o45 0.13 (n=875)
  // No 1X2/O-U odds coverage at all (no Odds API sport key) — thresholds are
  // profile estimates only (base − 0.05), observation only.
  KOR2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.66,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.44,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.46,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.67,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.79 · o25 0.56 · o35 0.36 · o45 0.19 (n=918)
  // No 2.5-line backtest recommendation (only 7 priced candidates — BTTS/O-U
  // odds coverage barely exists yet for this league) — thresholds below are
  // profile estimates only (base − 0.05), observation only.
  KSA1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.51,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.59,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.76,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.77 · o25 0.54 · o35 0.32 · o45 0.16 (n=925)
  L1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.49,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.41,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.78 · o25 0.54 · o35 0.35 · o45 0.21 (n=570)
  LAT1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.49,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.41,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.6,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.74 · o25 0.48 · o35 0.26 · o45 0.14 (n=1140)
  LL: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.43,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.47,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.81 · o25 0.60 · o35 0.37 · o45 0.21 (n=1132)
  MLS: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.76,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.55,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.58,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.78 · o25 0.55 · o35 0.31 · o45 0.17 (n=1016)
  MX1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.4,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.79 · o25 0.59 · o35 0.38 · o45 0.19 (n=766)
  NOR1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.57,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.76,
        minSampleN: 15,
      },
    ],
  },
  // Recalibrated 2026-07-03 on prod data (audit: 746 model runs, 4 seasons).
  // League drift: o35 0.31 → 0.39 → 0.39 → 0.58 (2026-27), avg goals 2.79 →
  // 3.98. Blended recent base (2025-26 + 2026-27, n=304): o15 0.87 · o25 0.66
  // · o35 0.43 · o45 0.24. corr(λ_total, goals) ≈ 0 every season and the
  // predicted→realized slope is ~0.25 → the model has league-LEVEL signal
  // only. The calibration itself is handled upstream by the O/U probability
  // shrinkage (probability/ou-shrinkage.ts, factor 0.25 toward the recent
  // base rates), so thresholds follow the standard base−0.05 rule on the
  // RECENT blend. Root cause (no xG in data-poor leagues) tracked in
  // docs/data-poor-leagues-calibration.md.
  NOR2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        // Tuning 2026-07-09 (post-rebuild, real priced odds): 0.65 validates
        // (ROI +15.5%, n=38, cov 70%) — supersedes the profile estimate (0.61).
        threshold: 0.65,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        // Recent under-rate 0.57 − 0.05. Shrunk probabilities cap under35 at
        // ~0.68 for this league, so the old 0.58 gate on raw (noise) probas —
        // which realized 37.5% live — cannot recur.
        threshold: 0.52,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.82 · o25 0.59 · o35 0.35 · o45 0.17 (n=1140)
  PL: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.77,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.6,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.78,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.76 · o25 0.50 · o35 0.30 · o45 0.14 (n=918)
  POL1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.78 · o25 0.55 · o35 0.31 · o45 0.15 (n=925)
  POL2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.41,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.75 · o25 0.53 · o35 0.30 · o45 0.13 (n=924)
  POR: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.75 · o25 0.48 · o35 0.27 · o45 0.13 (n=732)
  // No 2.5-line backtest recommendation (only 25 priced candidates) —
  // thresholds below are profile estimates only (base − 0.05), observation only.
  RUS1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.43,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.47,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.73 · o25 0.48 · o35 0.25 · o45 0.11 (n=1139)
  SA: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.43,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.47,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.84,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.78 · o25 0.55 · o35 0.32 · o45 0.14 (n=702)
  // No 2.5-line backtest recommendation (421 candidates swept, no PASS) —
  // thresholds below are profile estimates only (base − 0.05), observation only.
  SCO1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.69 · o25 0.45 · o35 0.25 · o45 0.11 (n=1403)
  SP2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.4,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.84,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.74 · o25 0.53 · o35 0.32 · o45 0.16 (n=892)
  SRB1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.81 · o25 0.59 · o35 0.36 · o45 0.19 (n=690)
  SUI1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.76,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.59,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.80 · o25 0.59 · o35 0.35 · o45 0.16 (n=538) — high-scoring league.
  // No 1X2/O-U odds coverage at all (no Odds API sport key) — thresholds are
  // profile estimates only (base − 0.05), observation only.
  SUI2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.6,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.80 · o25 0.55 · o35 0.32 · o45 0.16 (n=522)
  SVN1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.78 · o25 0.54 · o35 0.30 · o45 0.15 (n=767)
  SWE1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.49,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.41,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.76 · o25 0.55 · o35 0.32 · o45 0.14 (n=780)
  SWE2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.41,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.77 · o25 0.53 · o35 0.31 · o45 0.16 (n=1028)
  TUR1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        // Tuning 2026-07-09 (post-rebuild, real priced odds): the previous
        // 0.42 profile estimate was flat-negative in the channels backtest
        // (-5.8% ROI, n=480 priced). 0.6 validates instead (ROI +32.9%,
        // n=36, cov 7%) — narrower but genuinely profitable.
        threshold: 0.6,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.78 · o25 0.59 · o35 0.38 · o45 0.23 (n=774)
  UCL: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.57,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.77 · o25 0.55 · o35 0.31 · o45 0.17 (n=1235)
  UECL: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.41,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.77 · o25 0.56 · o35 0.32 · o45 0.16 (n=715)
  UEL: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.51,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.73 · o25 0.50 · o35 0.29 · o45 0.16 (n=1394)
  // No 1X2/O-U odds coverage at all (no Odds API sport key) — thresholds are
  // profile estimates only (base − 0.05), observation only.
  USA2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.66,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 15,
      },
    ],
  },
};

// Resolve the enabled GOALS line configs for a league (empty when none).
export function getGoalsLineConfigs(
  competitionCode: string | null | undefined,
): readonly GoalsLineConfig[] {
  if (competitionCode == null) return [];
  const leagueConfig = GOALS_CONFIG[competitionCode];
  if (!leagueConfig) return [];
  return leagueConfig.lines.filter((l) => l.enabled);
}

// ─────────────────────────────────────────────
// CONSENSUS (meta) — emits a 1X2 selection only when ≥ minLevel INDEPENDENT
// primary strategy classes agree on the same (market, pick). Calibrated
// GLOBALLY, not per-league: the agreement mechanism is league-agnostic and
// per-league volume is far too thin to calibrate.
//
// Validated 2026-06-23 on settled channel_selection (3 seasons). 1X2 level-2
// (two independent classes agree) vs level-1 baseline:
//   2023-24: +7.6% (n80) | 2024-25: +18.7% (n129) | 2025-26: +9.3% (n63)
//   baseline (1 class): -5.5% / -10.7% / -9.8% every season.
// Positive across all 3 seasons, baseline net-losing → the agreement filter
// carries the edge. v1 restricts to ONE_X_TWO (BTTS/OVER_UNDER level-2 too thin).
// ─────────────────────────────────────────────

export const CONSENSUS_CONFIG = {
  enabled: true,
  // Minimum number of distinct independence classes that must agree on a pick.
  minLevel: 2,
} as const;

// ─────────────────────────────────────────────
// AVOID (meta) — negative decision. Flags a fixture/pick that should not feed
// the recommendations. Of the doc's candidate triggers, only one fires
// meaningfully in our data: EXTREME model↔market divergence. The others are
// non-events here (no fixture ever has contradictory HOME&AWAY primaries;
// lambdaFloorHit is false everywhere) or already handled (missing odds → NO_BET).
//
// Validated 2026-06-23 on settled 1X2 selections (3 seasons): when the model
// claims an edge ≥ 0.30 over the market (probability − 1/odds), the MARKET is
// right, not the model — ROI by edge bucket: [20,30%) +10.9% but ≥30% −20.4%
// (hit 28%). Per season ≥30% is negative/flat AND worse than the rest every
// time: -34.2/-22.5/-0.7 vs +6.8/+3.1/+1.2. So extreme divergence signals a
// model/data problem, not an edge → AVOID blocks it. Global (league-agnostic).
export const AVOID_CONFIG = {
  enabled: true,
  // A selected pick whose model edge (probability − implied) reaches this is
  // treated as implausible → the fixture is flagged for avoidance.
  maxEdge: 0.3,
} as const;

// ─────────────────────────────────────────────
// CORRECT_SCORE (exact score) — OBSERVATION ONLY, PREDICTION channel (not value).
// Among the scorelines the book prices, emit the single MOST LIKELY one the model
// can price (argmax of the Poisson cell probability). Global config (the mechanism
// is league-agnostic). NEVER staked — odds are forward-collected only (no historical
// backtest), so a selection is recorded + settled analytically to accumulate forward
// data; the market price (odds/EV) is still stored for the bettor to judge.
//
// Argmax-EV was REJECTED (2026-07-01): on a ~40-outcome fat-tail market, maximizing
// EV = modelCellProbability × odds − 1 mechanically selects the cell where the model
// most over-prices vs the book — i.e. pure Poisson rounding noise on longshots
// (0:4 @ 501, "+1228% EV"), never a real edge. An independent Poisson simply cannot
// resolve a longshot scoreline to that precision, and the book is right there (same
// logic as AVOID's extreme-divergence rule above). The most probable scoreline is a
// credible, short-priced prediction; that is what serves a bettor.
//
// `minProbability` is a CONVICTION gate: if even the modal scoreline sits below it,
// no single score is predictable (match too open) → no pick. Dixon-Coles was rejected
// (2026-06-30): the independent Poisson matrix is as accurate on scorelines.
export const CORRECT_SCORE_CONFIG = {
  enabled: true,
  minProbability: 0.05,
} as const;

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

  if (channel === "DRAW") return DRAW_DEFAULT;
  if (channel === "BTTS") return BTTS_DEFAULT;
  return DOMINANT_DEFAULT;
}
