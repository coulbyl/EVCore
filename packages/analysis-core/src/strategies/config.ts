import Decimal from "decimal.js";

// DOMINANT picks are rejected when the argmax outcome leads the 2nd-best by less
// than this margin — prevents "barely-DOMINANT" picks where all three outcomes
// cluster near 33% (model has no real conviction).
export const DOMINANT_MIN_MARGIN = new Decimal("0.05");

// DOMINANT has no upper odds bound (unlike SAFE) but does need a floor: below
// this, the pick is a near-certain heavy favorite with a trivial payout —
// backtest 2026-07-20 shows the <1.20 bucket is DOMINANT's best-performing
// (89% hit rate, +1.23% ROI), so this isn't about accuracy, it's volume — the
// World Cup group stage flooded the feed with these low-value picks. Applied
// only when the book has a price; a price-less selection still passes through
// for analytical settlement.
export const DOMINANT_MIN_ODDS = new Decimal("1.20");

export type ChannelStrategyLeagueConfig = {
  enabled: boolean;
  threshold: number;
  minSampleN: number;
};

export type ChannelStrategyConfigChannel =
  | "DOMINANT"
  | "DRAW"
  | "BTTS"
  | "CLEAN_SHEET"
  | "WIN_EITHER_HALF";

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

// CLEAN_SHEET / WIN_EITHER_HALF — new channels (2026-07-18). No historical
// odds coverage exists for either market (odds-historical-import.worker.ts
// stub; The Odds API's standard /odds endpoint 422s even on BTTS/DNB, let
// alone these — see docs/market-coverage-expansion.md) — only the forward
// PREMATCH sync (API-Football) collects real prices, starting 2026-07-18.
// So there is no ROI/hit-rate backtest to run yet (unlike DOMINANT/DRAW/BTTS
// above). Enabled in OBSERVATION mode instead, same methodology as
// GOALS_CONFIG: threshold = (empirical base rate of the HOME side, the
// structurally stronger/more reliable signal — away clean-sheet and
// away-wins-a-half rates are consistently lower across every league in the
// data) − 0.05, a loose conviction gate meant to accumulate volume, not a
// fitted edge. Both channels pick argmax(HOME, AWAY) at runtime, so AWAY
// still surfaces on genuinely exceptional matches. Never staked (only
// EV/SAFE/DRAW feed the coupon pool) — a SELECTED decision here is recorded
// + settled analytically, zero exposure. Promote a league to a real
// backtested threshold only once forward ROI/hit-rate data confirms an edge.
// Derived 2026-07-18 from settled FT/HT scores (docker exec evcore-postgres
// psql — see commit for the exact query), all active leagues with n ≥ 50.
export const CLEAN_SHEET_CONFIG: Record<string, ChannelStrategyLeagueConfig> = {
  ARG1: { enabled: true, threshold: 0.39, minSampleN: 20 }, // CS home base 0.4352, away 0.3083, n=1521
  ARG2: { enabled: true, threshold: 0.42, minSampleN: 20 }, // CS home base 0.4692, away 0.3038, n=2406
  AUS1: { enabled: true, threshold: 0.18, minSampleN: 20 }, // CS home base 0.2323, away 0.2087, n=508
  AUT1: { enabled: true, threshold: 0.26, minSampleN: 20 }, // CS home base 0.3128, away 0.2444, n=585
  BEL1: { enabled: true, threshold: 0.25, minSampleN: 20 }, // CS home base 0.3049, away 0.2271, n=951
  BL1: { enabled: true, threshold: 0.2, minSampleN: 20 }, // CS home base 0.2478, away 0.2024, n=924
  BRA1: { enabled: true, threshold: 0.31, minSampleN: 20 }, // CS home base 0.3555, away 0.2200, n=1159
  BRA2: { enabled: true, threshold: 0.36, minSampleN: 20 }, // CS home base 0.4061, away 0.2443, n=1310
  CH: { enabled: true, threshold: 0.26, minSampleN: 20 }, // CS home base 0.3088, away 0.2316, n=1671
  CHI1: { enabled: true, threshold: 0.25, minSampleN: 20 }, // CS home base 0.3000, away 0.2190, n=840
  CHI2: { enabled: true, threshold: 0.25, minSampleN: 20 }, // CS home base 0.3008, away 0.2413, n=605
  CHN2: { enabled: true, threshold: 0.29, minSampleN: 20 }, // CS home base 0.3426, away 0.2425, n=829
  CSL: { enabled: true, threshold: 0.21, minSampleN: 20 }, // CS home base 0.2646, away 0.1918, n=756
  CZE1: { enabled: true, threshold: 0.29, minSampleN: 20 }, // CS home base 0.3382, away 0.2381, n=819
  D2: { enabled: true, threshold: 0.22, minSampleN: 20 }, // CS home base 0.2706, away 0.1894, n=924
  D3: { enabled: true, threshold: 0.22, minSampleN: 20 }, // CS home base 0.2675, away 0.1904, n=1140
  DEN1: { enabled: true, threshold: 0.2, minSampleN: 20 }, // CS home base 0.2522, away 0.1934, n=579
  EL1: { enabled: true, threshold: 0.26, minSampleN: 20 }, // CS home base 0.3112, away 0.2430, n=1671
  EL2: { enabled: true, threshold: 0.25, minSampleN: 20 }, // CS home base 0.3034, away 0.2310, n=1671
  ERD: { enabled: true, threshold: 0.22, minSampleN: 20 }, // CS home base 0.2733, away 0.1791, n=955
  EST1: { enabled: true, threshold: 0.24, minSampleN: 20 }, // CS home base 0.2870, away 0.2591, n=575
  F2: { enabled: true, threshold: 0.29, minSampleN: 20 }, // CS home base 0.3383, away 0.2633, n=999
  FIN1: { enabled: true, threshold: 0.21, minSampleN: 20 }, // CS home base 0.2585, away 0.2264, n=561
  FIN2: { enabled: true, threshold: 0.2, minSampleN: 20 }, // CS home base 0.2507, away 0.2216, n=343
  FRI: { enabled: true, threshold: 0.3, minSampleN: 20 }, // CS home base 0.3468, away 0.2370, n=346
  GRE1: { enabled: true, threshold: 0.27, minSampleN: 20 }, // CS home base 0.3174, away 0.2500, n=712
  I2: { enabled: true, threshold: 0.27, minSampleN: 20 }, // CS home base 0.3179, away 0.2325, n=1170
  IRL1: { enabled: true, threshold: 0.28, minSampleN: 20 }, // CS home base 0.3283, away 0.2530, n=664
  ISL1: { enabled: true, threshold: 0.17, minSampleN: 20 }, // CS home base 0.2220, away 0.1575, n=527
  J1: { enabled: true, threshold: 0.26, minSampleN: 20 }, // CS home base 0.3104, away 0.2520, n=1266
  KOR1: { enabled: true, threshold: 0.26, minSampleN: 20 }, // CS home base 0.3065, away 0.2331, n=708
  KOR2: { enabled: true, threshold: 0.24, minSampleN: 20 }, // CS home base 0.2877, away 0.2729, n=883
  KSA1: { enabled: true, threshold: 0.22, minSampleN: 20 }, // CS home base 0.2712, away 0.2146, n=918
  L1: { enabled: true, threshold: 0.26, minSampleN: 20 }, // CS home base 0.3059, away 0.2249, n=925
  LAT1: { enabled: true, threshold: 0.27, minSampleN: 20 }, // CS home base 0.3219, away 0.2449, n=584
  LL: { enabled: true, threshold: 0.26, minSampleN: 20 }, // CS home base 0.3123, away 0.2123, n=1140
  MLS: { enabled: true, threshold: 0.21, minSampleN: 20 }, // CS home base 0.2641, away 0.1811, n=1132
  MX1: { enabled: true, threshold: 0.26, minSampleN: 20 }, // CS home base 0.3071, away 0.1900, n=1016
  NOR1: { enabled: true, threshold: 0.24, minSampleN: 20 }, // CS home base 0.2868, away 0.2119, n=774
  NOR2: { enabled: true, threshold: 0.21, minSampleN: 20 }, // CS home base 0.2563, away 0.1834, n=796
  PL: { enabled: true, threshold: 0.22, minSampleN: 20 }, // CS home base 0.2691, away 0.2151, n=1520
  POL1: { enabled: true, threshold: 0.25, minSampleN: 20 }, // CS home base 0.3007, away 0.2135, n=918
  POL2: { enabled: true, threshold: 0.22, minSampleN: 20 }, // CS home base 0.2692, away 0.2292, n=925
  POR: { enabled: true, threshold: 0.27, minSampleN: 20 }, // CS home base 0.3203, away 0.2424, n=924
  RUS1: { enabled: true, threshold: 0.28, minSampleN: 20 }, // CS home base 0.3320, away 0.2227, n=732
  SA: { enabled: true, threshold: 0.27, minSampleN: 20 }, // CS home base 0.3169, away 0.2687, n=1139
  SCO1: { enabled: true, threshold: 0.27, minSampleN: 20 }, // CS home base 0.3248, away 0.2151, n=702
  SP2: { enabled: true, threshold: 0.3, minSampleN: 20 }, // CS home base 0.3521, away 0.2366, n=1403
  SRB1: { enabled: true, threshold: 0.27, minSampleN: 20 }, // CS home base 0.3195, away 0.2365, n=892
  SUI1: { enabled: true, threshold: 0.2, minSampleN: 20 }, // CS home base 0.2507, away 0.1783, n=690
  SUI2: { enabled: true, threshold: 0.22, minSampleN: 20 }, // CS home base 0.2695, away 0.2156, n=538
  SVN1: { enabled: true, threshold: 0.23, minSampleN: 20 }, // CS home base 0.2778, away 0.2203, n=522
  SWE1: { enabled: true, threshold: 0.24, minSampleN: 20 }, // CS home base 0.2950, away 0.2324, n=783
  SWE2: { enabled: true, threshold: 0.25, minSampleN: 20 }, // CS home base 0.3046, away 0.2259, n=788
  TUR1: { enabled: true, threshold: 0.26, minSampleN: 20 }, // CS home base 0.3054, away 0.2189, n=1028
  TUR2: { enabled: true, threshold: 0.31, minSampleN: 20 }, // CS home base 0.3562, away 0.2609, n=1081
  UCL: { enabled: true, threshold: 0.26, minSampleN: 20 }, // CS home base 0.3108, away 0.2030, n=798
  UECL: { enabled: true, threshold: 0.28, minSampleN: 20 }, // CS home base 0.3344, away 0.2211, n=1262
  UEL: { enabled: true, threshold: 0.27, minSampleN: 20 }, // CS home base 0.3245, away 0.2080, n=721
  UNL: { enabled: true, threshold: 0.33, minSampleN: 20 }, // CS home base 0.3777, away 0.2500, n=188
  USA2: { enabled: true, threshold: 0.27, minSampleN: 20 }, // CS home base 0.3159, away 0.2393, n=1396
  WC: { enabled: true, threshold: 0.28, minSampleN: 20 }, // CS home base 0.3273, away 0.2424, n=165
  WCQAF: { enabled: true, threshold: 0.33, minSampleN: 20 }, // CS home base 0.3800, away 0.3230, n=421
  WCQAS: { enabled: true, threshold: 0.35, minSampleN: 20 }, // CS home base 0.4013, away 0.3246, n=456
  WCQCA: { enabled: true, threshold: 0.4, minSampleN: 20 }, // CS home base 0.4541, away 0.2890, n=218
  WCQE: { enabled: true, threshold: 0.28, minSampleN: 20 }, // CS home base 0.3268, away 0.2944, n=462
  WCQSA: { enabled: true, threshold: 0.46, minSampleN: 20 }, // CS home base 0.5140, away 0.2849, n=179
};

const CLEAN_SHEET_DEFAULT: ChannelStrategyLeagueConfig = {
  enabled: false,
  threshold: 0.99,
  minSampleN: 20,
};

export const WIN_EITHER_HALF_CONFIG: Record<
  string,
  ChannelStrategyLeagueConfig
> = {
  ARG1: { enabled: true, threshold: 0.49, minSampleN: 20 }, // WEH home base 0.5358, away 0.3688, n=1521
  ARG2: { enabled: true, threshold: 0.51, minSampleN: 20 }, // WEH home base 0.5590, away 0.3379, n=2406
  AUS1: { enabled: true, threshold: 0.51, minSampleN: 20 }, // WEH home base 0.5610, away 0.5236, n=508
  AUT1: { enabled: true, threshold: 0.49, minSampleN: 20 }, // WEH home base 0.5350, away 0.4615, n=585
  BEL1: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5720, away 0.4469, n=951
  BL1: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5714, away 0.4805, n=924
  BRA1: { enabled: true, threshold: 0.56, minSampleN: 20 }, // WEH home base 0.6066, away 0.4038, n=1159
  BRA2: { enabled: true, threshold: 0.54, minSampleN: 20 }, // WEH home base 0.5947, away 0.3817, n=1310
  CH: { enabled: true, threshold: 0.53, minSampleN: 20 }, // WEH home base 0.5757, away 0.4554, n=1671
  CHI1: { enabled: true, threshold: 0.53, minSampleN: 20 }, // WEH home base 0.5828, away 0.4505, n=839
  CHI2: { enabled: true, threshold: 0.5, minSampleN: 20 }, // WEH home base 0.5515, away 0.4668, n=602
  CHN2: { enabled: true, threshold: 0.51, minSampleN: 20 }, // WEH home base 0.5585, away 0.4077, n=829
  CSL: { enabled: true, threshold: 0.56, minSampleN: 20 }, // WEH home base 0.6058, away 0.4696, n=756
  CZE1: { enabled: true, threshold: 0.53, minSampleN: 20 }, // WEH home base 0.5824, away 0.4335, n=819
  D2: { enabled: true, threshold: 0.57, minSampleN: 20 }, // WEH home base 0.6190, away 0.4859, n=924
  D3: { enabled: true, threshold: 0.56, minSampleN: 20 }, // WEH home base 0.6061, away 0.4570, n=1140
  DEN1: { enabled: true, threshold: 0.53, minSampleN: 20 }, // WEH home base 0.5786, away 0.4922, n=579
  EL1: { enabled: true, threshold: 0.53, minSampleN: 20 }, // WEH home base 0.5829, away 0.4758, n=1671
  EL2: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5673, away 0.4638, n=1671
  ERD: { enabled: true, threshold: 0.54, minSampleN: 20 }, // WEH home base 0.5864, away 0.4607, n=955
  EST1: { enabled: true, threshold: 0.49, minSampleN: 20 }, // WEH home base 0.5357, away 0.5078, n=575
  F2: { enabled: true, threshold: 0.51, minSampleN: 20 }, // WEH home base 0.5616, away 0.4575, n=999
  FIN1: { enabled: true, threshold: 0.53, minSampleN: 20 }, // WEH home base 0.5758, away 0.4759, n=561
  FIN2: { enabled: true, threshold: 0.51, minSampleN: 20 }, // WEH home base 0.5598, away 0.4665, n=343
  FRI: { enabled: true, threshold: 0.54, minSampleN: 20 }, // WEH home base 0.5929, away 0.4159, n=339
  GRE1: { enabled: true, threshold: 0.51, minSampleN: 20 }, // WEH home base 0.5640, away 0.4501, n=711
  I2: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5697, away 0.4380, n=1169
  IRL1: { enabled: true, threshold: 0.53, minSampleN: 20 }, // WEH home base 0.5798, away 0.4473, n=664
  ISL1: { enabled: true, threshold: 0.58, minSampleN: 20 }, // WEH home base 0.6319, away 0.4611, n=527
  J1: { enabled: true, threshold: 0.49, minSampleN: 20 }, // WEH home base 0.5403, away 0.4597, n=1266
  KOR1: { enabled: true, threshold: 0.5, minSampleN: 20 }, // WEH home base 0.5452, away 0.4562, n=708
  KOR2: { enabled: true, threshold: 0.47, minSampleN: 20 }, // WEH home base 0.5176, away 0.4892, n=883
  KSA1: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5719, away 0.4869, n=918
  L1: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5708, away 0.4584, n=925
  LAT1: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5702, away 0.4623, n=584
  LL: { enabled: true, threshold: 0.56, minSampleN: 20 }, // WEH home base 0.6088, away 0.4404, n=1140
  MLS: { enabled: true, threshold: 0.56, minSampleN: 20 }, // WEH home base 0.6095, away 0.4708, n=1132
  MX1: { enabled: true, threshold: 0.56, minSampleN: 20 }, // WEH home base 0.6132, away 0.4262, n=1016
  NOR1: { enabled: true, threshold: 0.54, minSampleN: 20 }, // WEH home base 0.5879, away 0.4664, n=774
  NOR2: { enabled: true, threshold: 0.55, minSampleN: 20 }, // WEH home base 0.6013, away 0.4893, n=795
  PL: { enabled: true, threshold: 0.54, minSampleN: 20 }, // WEH home base 0.5947, away 0.4770, n=1520
  POL1: { enabled: true, threshold: 0.55, minSampleN: 20 }, // WEH home base 0.6002, away 0.4412, n=918
  POL2: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5703, away 0.4838, n=924
  POR: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5660, away 0.4643, n=924
  RUS1: { enabled: true, threshold: 0.55, minSampleN: 20 }, // WEH home base 0.5956, away 0.4426, n=732
  SA: { enabled: true, threshold: 0.5, minSampleN: 20 }, // WEH home base 0.5461, away 0.4732, n=1139
  SCO1: { enabled: true, threshold: 0.55, minSampleN: 20 }, // WEH home base 0.6040, away 0.4644, n=702
  SP2: { enabled: true, threshold: 0.54, minSampleN: 20 }, // WEH home base 0.5852, away 0.4041, n=1403
  SRB1: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5661, away 0.4686, n=892
  SUI1: { enabled: true, threshold: 0.56, minSampleN: 20 }, // WEH home base 0.6145, away 0.4681, n=690
  SUI2: { enabled: true, threshold: 0.51, minSampleN: 20 }, // WEH home base 0.5576, away 0.4851, n=538
  SVN1: { enabled: true, threshold: 0.55, minSampleN: 20 }, // WEH home base 0.6019, away 0.4769, n=520
  SWE1: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5709, away 0.4853, n=783
  SWE2: { enabled: true, threshold: 0.55, minSampleN: 20 }, // WEH home base 0.5952, away 0.4492, n=788
  TUR1: { enabled: true, threshold: 0.56, minSampleN: 20 }, // WEH home base 0.6076, away 0.4460, n=1027
  TUR2: { enabled: true, threshold: 0.51, minSampleN: 20 }, // WEH home base 0.5611, away 0.4306, n=1080
  UCL: { enabled: true, threshold: 0.55, minSampleN: 20 }, // WEH home base 0.6040, away 0.4398, n=798
  UECL: { enabled: true, threshold: 0.55, minSampleN: 20 }, // WEH home base 0.6008, away 0.4310, n=1260
  UEL: { enabled: true, threshold: 0.57, minSampleN: 20 }, // WEH home base 0.6172, away 0.4355, n=721
  UNL: { enabled: true, threshold: 0.55, minSampleN: 20 }, // WEH home base 0.6043, away 0.4652, n=187
  USA2: { enabled: true, threshold: 0.52, minSampleN: 20 }, // WEH home base 0.5716, away 0.4398, n=1396
  WC: { enabled: true, threshold: 0.54, minSampleN: 20 }, // WEH home base 0.5879, away 0.4303, n=165
  WCQAF: { enabled: true, threshold: 0.48, minSampleN: 20 }, // WEH home base 0.5300, away 0.4317, n=417
  WCQAS: { enabled: true, threshold: 0.5, minSampleN: 20 }, // WEH home base 0.5507, away 0.4361, n=454
  WCQCA: { enabled: true, threshold: 0.53, minSampleN: 20 }, // WEH home base 0.5760, away 0.3825, n=217
  WCQE: { enabled: true, threshold: 0.51, minSampleN: 20 }, // WEH home base 0.5563, away 0.4827, n=462
  WCQSA: { enabled: true, threshold: 0.55, minSampleN: 20 }, // WEH home base 0.6034, away 0.3073, n=179
};

const WIN_EITHER_HALF_DEFAULT: ChannelStrategyLeagueConfig = {
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
  ["DOMINANT", "DRAW", "BTTS", "CLEAN_SHEET", "WIN_EITHER_HALF"];

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
// TEAM_TOTAL — per-team goals line (2026-07-18), same shape as GOALS but
// doubled on the team dimension (HOME/AWAY have independent lines/sides).
// No historical odds coverage exists (forward PREMATCH sync only, same
// limitation as CLEAN_SHEET/WIN_EITHER_HALF above) — OBSERVATION mode,
// structural thresholds derived from real FT scores in the DB (no ROI
// backtest yet). Same curation method as GOALS_CONFIG: per (team, line),
// side = OVER when the empirical over-rate ≥ 0.55, UNDER when ≤ 0.45, BOTH
// in the 0.45–0.55 band; threshold = (base rate of the chosen side) − 0.05.
// Lines where the chosen side's base rate exceeds 0.90 are dropped entirely
// (e.g. "Away UNDER 4.5" at a 99% base rate) — a near-certain pick fires on
// almost every fixture and carries no information, unlike GOALS/CLEAN_SHEET
// where every kept line sits in a genuinely uncertain range. Never staked —
// a SELECTED decision here is recorded + settled analytically, zero
// exposure. Derived 2026-07-18 from settled scores (docker exec
// evcore-postgres psql), all active leagues with n ≥ 50.
// ─────────────────────────────────────────────

export type TeamTotalTeam = "HOME" | "AWAY";
export type TeamTotalLine = 0.5 | 1.5 | 2.5 | 3.5 | 4.5;
export type TeamTotalSide = "OVER" | "UNDER";

export type TeamTotalLineConfig = {
  team: TeamTotalTeam;
  line: TeamTotalLine;
  side: TeamTotalSide;
  enabled: boolean;
  threshold: number;
  minSampleN: number;
};

export type TeamTotalLeagueConfig = {
  lines: readonly TeamTotalLineConfig[];
};

export const TEAM_TOTAL_CONFIG: Record<string, TeamTotalLeagueConfig> = {
  ARG1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 20,
      }, // ARG1 HOME O0_5 base 0.6917
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 20,
      }, // ARG1 HOME U1_5 base 0.6759
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.84,
        minSampleN: 20,
      }, // ARG1 HOME U2_5 base 0.8895
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.51,
        minSampleN: 20,
      }, // ARG1 AWAY O0_5 base 0.5648
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 20,
      }, // ARG1 AWAY U1_5 base 0.7955
    ],
  },
  ARG2: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 20,
      }, // ARG2 HOME O0_5 base 0.6962
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 20,
      }, // ARG2 HOME U1_5 base 0.6775
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.85,
        minSampleN: 20,
      }, // ARG2 HOME U2_5 base 0.8994
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 20,
      }, // ARG2 AWAY O0_5 base 0.5308 (mid-band, both sides)
      {
        team: "AWAY",
        line: 0.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 20,
      }, // ARG2 AWAY U0_5 base 0.4692 (mid-band, both sides)
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.78,
        minSampleN: 20,
      }, // ARG2 AWAY U1_5 base 0.8321
    ],
  },
  AUS1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 20,
      }, // AUS1 HOME O0_5 base 0.7913
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.41,
        minSampleN: 20,
      }, // AUS1 HOME O1_5 base 0.4646 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.49,
        minSampleN: 20,
      }, // AUS1 HOME U1_5 base 0.5354 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 20,
      }, // AUS1 HOME U2_5 base 0.7697
      {
        team: "HOME",
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.85,
        minSampleN: 20,
      }, // AUS1 HOME U3_5 base 0.8957
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 20,
      }, // AUS1 AWAY O0_5 base 0.7677
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 20,
      }, // AUS1 AWAY U1_5 base 0.5512
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.77,
        minSampleN: 20,
      }, // AUS1 AWAY U2_5 base 0.8248
    ],
  },
  AUT1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 20,
      }, // AUT1 HOME O0_5 base 0.7556
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.53,
        minSampleN: 20,
      }, // AUT1 HOME U1_5 base 0.5812
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.78,
        minSampleN: 20,
      }, // AUT1 HOME U2_5 base 0.8325
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 20,
      }, // AUT1 AWAY O0_5 base 0.6872
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.59,
        minSampleN: 20,
      }, // AUT1 AWAY U1_5 base 0.6444
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 20,
      }, // AUT1 AWAY U2_5 base 0.8615
    ],
  },
  BEL1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 20,
      }, // BEL1 HOME O0_5 base 0.7729
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.52,
        minSampleN: 20,
      }, // BEL1 HOME U1_5 base 0.5699
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 20,
      }, // BEL1 HOME U2_5 base 0.7939
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 20,
      }, // BEL1 AWAY O0_5 base 0.6951
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.61,
        minSampleN: 20,
      }, // BEL1 AWAY U1_5 base 0.6593
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 20,
      }, // BEL1 AWAY U2_5 base 0.8707
    ],
  },
  BL1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 20,
      }, // BL1 HOME O0_5 base 0.7976
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 20,
      }, // BL1 HOME O1_5 base 0.5022 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 20,
      }, // BL1 HOME U1_5 base 0.4978 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 20,
      }, // BL1 HOME U2_5 base 0.7338
      {
        team: "HOME",
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.84,
        minSampleN: 20,
      }, // BL1 HOME U3_5 base 0.8907
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 20,
      }, // BL1 AWAY O0_5 base 0.7522
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.53,
        minSampleN: 20,
      }, // BL1 AWAY U1_5 base 0.5833
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 20,
      }, // BL1 AWAY U2_5 base 0.7998
    ],
  },
  BRA1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 20,
      }, // BRA1 HOME O0_5 base 0.78
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.52,
        minSampleN: 20,
      }, // BRA1 HOME U1_5 base 0.5686
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.78,
        minSampleN: 20,
      }, // BRA1 HOME U2_5 base 0.8309
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.59,
        minSampleN: 20,
      }, // BRA1 AWAY O0_5 base 0.6445
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 20,
      }, // BRA1 AWAY U1_5 base 0.7265
    ],
  },
  BRA2: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 20,
      }, // BRA2 HOME O0_5 base 0.7557
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.58,
        minSampleN: 20,
      }, // BRA2 HOME U1_5 base 0.629
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 20,
      }, // BRA2 HOME U2_5 base 0.874
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 20,
      }, // BRA2 AWAY O0_5 base 0.5939
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 20,
      }, // BRA2 AWAY U1_5 base 0.7725
    ],
  },
  CH: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 20,
      }, // CH HOME O0_5 base 0.7684
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 20,
      }, // CH HOME U1_5 base 0.5895
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.78,
        minSampleN: 20,
      }, // CH HOME U2_5 base 0.8253
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 20,
      }, // CH AWAY O0_5 base 0.6912
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 20,
      }, // CH AWAY U1_5 base 0.6888
    ],
  },
  CHI1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 20,
      }, // CHI1 HOME O0_5 base 0.781
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.41,
        minSampleN: 20,
      }, // CHI1 HOME O1_5 base 0.4631 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.49,
        minSampleN: 20,
      }, // CHI1 HOME U1_5 base 0.5369 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.76,
        minSampleN: 20,
      }, // CHI1 HOME U2_5 base 0.8131
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 20,
      }, // CHI1 AWAY O0_5 base 0.7
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.62,
        minSampleN: 20,
      }, // CHI1 AWAY U1_5 base 0.669
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.83,
        minSampleN: 20,
      }, // CHI1 AWAY U2_5 base 0.8762
    ],
  },
  CHI2: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 20,
      }, // CHI2 HOME O0_5 base 0.7587
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.55,
        minSampleN: 20,
      }, // CHI2 HOME U1_5 base 0.6
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.78,
        minSampleN: 20,
      }, // CHI2 HOME U2_5 base 0.8281
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 20,
      }, // CHI2 AWAY O0_5 base 0.6992
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 20,
      }, // CHI2 AWAY U1_5 base 0.6893
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.83,
        minSampleN: 20,
      }, // CHI2 AWAY U2_5 base 0.876
    ],
  },
  CHN2: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 20,
      }, // CHN2 HOME O0_5 base 0.7575
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 20,
      }, // CHN2 HOME U1_5 base 0.5887
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 20,
      }, // CHN2 HOME U2_5 base 0.848
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.61,
        minSampleN: 20,
      }, // CHN2 AWAY O0_5 base 0.6574
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 20,
      }, // CHN2 AWAY U1_5 base 0.7274
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.84,
        minSampleN: 20,
      }, // CHN2 AWAY U2_5 base 0.8926
    ],
  },
  CSL: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.76,
        minSampleN: 20,
      }, // CSL HOME O0_5 base 0.8082
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.44,
        minSampleN: 20,
      }, // CSL HOME O1_5 base 0.4907 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.46,
        minSampleN: 20,
      }, // CSL HOME U1_5 base 0.5093 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 20,
      }, // CSL HOME U2_5 base 0.7407
      {
        team: "HOME",
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.85,
        minSampleN: 20,
      }, // CSL HOME U3_5 base 0.8995
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 20,
      }, // CSL AWAY O0_5 base 0.7354
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.58,
        minSampleN: 20,
      }, // CSL AWAY U1_5 base 0.6257
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 20,
      }, // CSL AWAY U2_5 base 0.8545
    ],
  },
  CZE1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 20,
      }, // CZE1 HOME O0_5 base 0.7619
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.51,
        minSampleN: 20,
      }, // CZE1 HOME U1_5 base 0.5617
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.76,
        minSampleN: 20,
      }, // CZE1 HOME U2_5 base 0.8144
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.61,
        minSampleN: 20,
      }, // CZE1 AWAY O0_5 base 0.6618
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.61,
        minSampleN: 20,
      }, // CZE1 AWAY U1_5 base 0.663
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 20,
      }, // CZE1 AWAY U2_5 base 0.8584
    ],
  },
  D2: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.76,
        minSampleN: 20,
      }, // D2 HOME O0_5 base 0.8106
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.44,
        minSampleN: 20,
      }, // D2 HOME O1_5 base 0.4881 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.46,
        minSampleN: 20,
      }, // D2 HOME U1_5 base 0.5119 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 20,
      }, // D2 HOME U2_5 base 0.7695
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 20,
      }, // D2 AWAY O0_5 base 0.7294
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.55,
        minSampleN: 20,
      }, // D2 AWAY U1_5 base 0.5952
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 20,
      }, // D2 AWAY U2_5 base 0.8431
    ],
  },
  D3: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.76,
        minSampleN: 20,
      }, // D3 HOME O0_5 base 0.8096
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.44,
        minSampleN: 20,
      }, // D3 HOME O1_5 base 0.4939 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.46,
        minSampleN: 20,
      }, // D3 HOME U1_5 base 0.5061 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 20,
      }, // D3 HOME U2_5 base 0.7851
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 20,
      }, // D3 AWAY O0_5 base 0.7325
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.59,
        minSampleN: 20,
      }, // D3 AWAY U1_5 base 0.6377
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 20,
      }, // D3 AWAY U2_5 base 0.8351
    ],
  },
  DEN1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.76,
        minSampleN: 20,
      }, // DEN1 HOME O0_5 base 0.8066
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 20,
      }, // DEN1 HOME O1_5 base 0.4732 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 20,
      }, // DEN1 HOME U1_5 base 0.5268 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 20,
      }, // DEN1 HOME U2_5 base 0.791
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 20,
      }, // DEN1 AWAY O0_5 base 0.7478
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.52,
        minSampleN: 20,
      }, // DEN1 AWAY U1_5 base 0.5682
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 20,
      }, // DEN1 AWAY U2_5 base 0.8394
    ],
  },
  EL1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 20,
      }, // EL1 HOME O0_5 base 0.757
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 20,
      }, // EL1 HOME U1_5 base 0.5871
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.77,
        minSampleN: 20,
      }, // EL1 HOME U2_5 base 0.8235
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 20,
      }, // EL1 AWAY O0_5 base 0.6888
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.62,
        minSampleN: 20,
      }, // EL1 AWAY U1_5 base 0.6709
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.84,
        minSampleN: 20,
      }, // EL1 AWAY U2_5 base 0.8851
    ],
  },
  EL2: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 20,
      }, // EL2 HOME O0_5 base 0.769
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 20,
      }, // EL2 HOME U1_5 base 0.5877
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.77,
        minSampleN: 20,
      }, // EL2 HOME U2_5 base 0.8199
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 20,
      }, // EL2 AWAY O0_5 base 0.6966
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.6,
        minSampleN: 20,
      }, // EL2 AWAY U1_5 base 0.6547
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 20,
      }, // EL2 AWAY U2_5 base 0.8701
    ],
  },
  ERD: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.77,
        minSampleN: 20,
      }, // ERD HOME O0_5 base 0.8209
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 20,
      }, // ERD HOME O1_5 base 0.5026 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 20,
      }, // ERD HOME U1_5 base 0.4974 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 20,
      }, // ERD HOME U2_5 base 0.7497
      {
        team: "HOME",
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.84,
        minSampleN: 20,
      }, // ERD HOME U3_5 base 0.8869
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 20,
      }, // ERD AWAY O0_5 base 0.7267
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 20,
      }, // ERD AWAY U1_5 base 0.5885
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 20,
      }, // ERD AWAY U2_5 base 0.845
    ],
  },
  EST1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 20,
      }, // EST1 HOME O0_5 base 0.7409
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.52,
        minSampleN: 20,
      }, // EST1 HOME U1_5 base 0.5722
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 20,
      }, // EST1 HOME U2_5 base 0.7965
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.66,
        minSampleN: 20,
      }, // EST1 AWAY O0_5 base 0.713
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.56,
        minSampleN: 20,
      }, // EST1 AWAY U1_5 base 0.6104
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.78,
        minSampleN: 20,
      }, // EST1 AWAY U2_5 base 0.8296
    ],
  },
  F2: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 20,
      }, // F2 HOME O0_5 base 0.7367
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.55,
        minSampleN: 20,
      }, // F2 HOME U1_5 base 0.5976
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 20,
      }, // F2 HOME U2_5 base 0.8358
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.61,
        minSampleN: 20,
      }, // F2 AWAY O0_5 base 0.6617
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 20,
      }, // F2 AWAY U1_5 base 0.6797
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.83,
        minSampleN: 20,
      }, // F2 AWAY U2_5 base 0.8799
    ],
  },
  FIN1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 20,
      }, // FIN1 HOME O0_5 base 0.7736
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.43,
        minSampleN: 20,
      }, // FIN1 HOME O1_5 base 0.4831 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.47,
        minSampleN: 20,
      }, // FIN1 HOME U1_5 base 0.5169 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 20,
      }, // FIN1 HOME U2_5 base 0.7594
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 20,
      }, // FIN1 AWAY O0_5 base 0.7415
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.55,
        minSampleN: 20,
      }, // FIN1 AWAY U1_5 base 0.6007
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 20,
      }, // FIN1 AWAY U2_5 base 0.8556
    ],
  },
  FIN2: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 20,
      }, // FIN2 HOME O0_5 base 0.7784
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.41,
        minSampleN: 20,
      }, // FIN2 HOME O1_5 base 0.4606 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.49,
        minSampleN: 20,
      }, // FIN2 HOME U1_5 base 0.5394 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 20,
      }, // FIN2 HOME U2_5 base 0.7638
      {
        team: "HOME",
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.84,
        minSampleN: 20,
      }, // FIN2 HOME U3_5 base 0.8892
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 20,
      }, // FIN2 AWAY O0_5 base 0.7493
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.56,
        minSampleN: 20,
      }, // FIN2 AWAY U1_5 base 0.6064
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.78,
        minSampleN: 20,
      }, // FIN2 AWAY U2_5 base 0.8309
    ],
  },
  FRI: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 20,
      }, // FRI HOME O0_5 base 0.763
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 20,
      }, // FRI HOME O1_5 base 0.4711 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 20,
      }, // FRI HOME U1_5 base 0.5289 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 20,
      }, // FRI HOME U2_5 base 0.7514
      {
        team: "HOME",
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.83,
        minSampleN: 20,
      }, // FRI HOME U3_5 base 0.8844
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.6,
        minSampleN: 20,
      }, // FRI AWAY O0_5 base 0.6532
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 20,
      }, // FRI AWAY U1_5 base 0.7023
    ],
  },
  GRE1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 20,
      }, // GRE1 HOME O0_5 base 0.75
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.52,
        minSampleN: 20,
      }, // GRE1 HOME U1_5 base 0.5744
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 20,
      }, // GRE1 HOME U2_5 base 0.7949
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 20,
      }, // GRE1 AWAY O0_5 base 0.6826
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.6,
        minSampleN: 20,
      }, // GRE1 AWAY U1_5 base 0.6545
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.84,
        minSampleN: 20,
      }, // GRE1 AWAY U2_5 base 0.8876
    ],
  },
  I2: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 20,
      }, // I2 HOME O0_5 base 0.7675
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 20,
      }, // I2 HOME U1_5 base 0.588
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 20,
      }, // I2 HOME U2_5 base 0.8436
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 20,
      }, // I2 AWAY O0_5 base 0.6821
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 20,
      }, // I2 AWAY U1_5 base 0.6829
    ],
  },
  IRL1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 20,
      }, // IRL1 HOME O0_5 base 0.747
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 20,
      }, // IRL1 HOME U1_5 base 0.5858
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 20,
      }, // IRL1 HOME U2_5 base 0.8434
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.62,
        minSampleN: 20,
      }, // IRL1 AWAY O0_5 base 0.6717
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 20,
      }, // IRL1 AWAY U1_5 base 0.7003
    ],
  },
  ISL1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 20,
      }, // ISL1 HOME O0_5 base 0.8425
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.53,
        minSampleN: 20,
      }, // ISL1 HOME O1_5 base 0.5787
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 20,
      }, // ISL1 HOME U2_5 base 0.6831
      {
        team: "HOME",
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 20,
      }, // ISL1 HOME U3_5 base 0.8482
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 20,
      }, // ISL1 AWAY O0_5 base 0.778
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.51,
        minSampleN: 20,
      }, // ISL1 AWAY U1_5 base 0.5617
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 20,
      }, // ISL1 AWAY U2_5 base 0.8046
    ],
  },
  J1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 20,
      }, // J1 HOME O0_5 base 0.748
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.55,
        minSampleN: 20,
      }, // J1 HOME U1_5 base 0.6011
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 20,
      }, // J1 HOME U2_5 base 0.8468
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 20,
      }, // J1 AWAY O0_5 base 0.6896
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 20,
      }, // J1 AWAY U1_5 base 0.6777
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.83,
        minSampleN: 20,
      }, // J1 AWAY U2_5 base 0.8799
    ],
  },
  KOR1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 20,
      }, // KOR1 HOME O0_5 base 0.7669
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 20,
      }, // KOR1 HOME U1_5 base 0.5918
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 20,
      }, // KOR1 HOME U2_5 base 0.8503
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 20,
      }, // KOR1 AWAY O0_5 base 0.6935
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.62,
        minSampleN: 20,
      }, // KOR1 AWAY U1_5 base 0.6723
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.83,
        minSampleN: 20,
      }, // KOR1 AWAY U2_5 base 0.8842
    ],
  },
  KOR2: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 20,
      }, // KOR2 HOME O0_5 base 0.7271
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.56,
        minSampleN: 20,
      }, // KOR2 HOME U1_5 base 0.6082
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 20,
      }, // KOR2 HOME U2_5 base 0.8471
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.66,
        minSampleN: 20,
      }, // KOR2 AWAY O0_5 base 0.7123
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.59,
        minSampleN: 20,
      }, // KOR2 AWAY U1_5 base 0.6399
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 20,
      }, // KOR2 AWAY U2_5 base 0.8596
    ],
  },
  KSA1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 20,
      }, // KSA1 HOME O0_5 base 0.7854
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 20,
      }, // KSA1 HOME U1_5 base 0.5512
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 20,
      }, // KSA1 HOME U2_5 base 0.7843
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 20,
      }, // KSA1 AWAY O0_5 base 0.7288
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.57,
        minSampleN: 20,
      }, // KSA1 AWAY U1_5 base 0.6187
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.77,
        minSampleN: 20,
      }, // KSA1 AWAY U2_5 base 0.8224
    ],
  },
  L1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 20,
      }, // L1 HOME O0_5 base 0.7751
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.4,
        minSampleN: 20,
      }, // L1 HOME O1_5 base 0.4508 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 20,
      }, // L1 HOME U1_5 base 0.5492 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 20,
      }, // L1 HOME U2_5 base 0.7859
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 20,
      }, // L1 AWAY O0_5 base 0.6941
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.59,
        minSampleN: 20,
      }, // L1 AWAY U1_5 base 0.6368
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 20,
      }, // L1 AWAY U2_5 base 0.8454
    ],
  },
  LAT1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 20,
      }, // LAT1 HOME O0_5 base 0.7551
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.4,
        minSampleN: 20,
      }, // LAT1 HOME O1_5 base 0.4521 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 20,
      }, // LAT1 HOME U1_5 base 0.5479 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 20,
      }, // LAT1 HOME U2_5 base 0.762
      {
        team: "HOME",
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.84,
        minSampleN: 20,
      }, // LAT1 HOME U3_5 base 0.8904
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 20,
      }, // LAT1 AWAY O0_5 base 0.6781
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.6,
        minSampleN: 20,
      }, // LAT1 AWAY U1_5 base 0.6455
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 20,
      }, // LAT1 AWAY U2_5 base 0.839
    ],
  },
  LL: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 20,
      }, // LL HOME O0_5 base 0.7877
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.53,
        minSampleN: 20,
      }, // LL HOME U1_5 base 0.5825
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 20,
      }, // LL HOME U2_5 base 0.8044
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 20,
      }, // LL AWAY O0_5 base 0.6877
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 20,
      }, // LL AWAY U1_5 base 0.6772
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.85,
        minSampleN: 20,
      }, // LL AWAY U2_5 base 0.8965
    ],
  },
  MLS: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.77,
        minSampleN: 20,
      }, // MLS HOME O0_5 base 0.8189
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.47,
        minSampleN: 20,
      }, // MLS HOME O1_5 base 0.5168 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.43,
        minSampleN: 20,
      }, // MLS HOME U1_5 base 0.4832 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 20,
      }, // MLS HOME U2_5 base 0.7659
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 20,
      }, // MLS AWAY O0_5 base 0.7359
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.55,
        minSampleN: 20,
      }, // MLS AWAY U1_5 base 0.5954
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.78,
        minSampleN: 20,
      }, // MLS AWAY U2_5 base 0.8277
    ],
  },
  MX1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.76,
        minSampleN: 20,
      }, // MX1 HOME O0_5 base 0.81
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.43,
        minSampleN: 20,
      }, // MX1 HOME O1_5 base 0.4833 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.47,
        minSampleN: 20,
      }, // MX1 HOME U1_5 base 0.5167 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 20,
      }, // MX1 HOME U2_5 base 0.7687
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 20,
      }, // MX1 AWAY O0_5 base 0.6929
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.61,
        minSampleN: 20,
      }, // MX1 AWAY U1_5 base 0.6565
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.83,
        minSampleN: 20,
      }, // MX1 AWAY U2_5 base 0.8799
    ],
  },
  NOR1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 20,
      }, // NOR1 HOME O0_5 base 0.7881
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.44,
        minSampleN: 20,
      }, // NOR1 HOME O1_5 base 0.491 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.46,
        minSampleN: 20,
      }, // NOR1 HOME U1_5 base 0.509 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 20,
      }, // NOR1 HOME U2_5 base 0.7455
      {
        team: "HOME",
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.84,
        minSampleN: 20,
      }, // NOR1 HOME U3_5 base 0.8863
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.66,
        minSampleN: 20,
      }, // NOR1 AWAY O0_5 base 0.7132
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.57,
        minSampleN: 20,
      }, // NOR1 AWAY U1_5 base 0.6227
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 20,
      }, // NOR1 AWAY U2_5 base 0.8372
    ],
  },
  NOR2: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.77,
        minSampleN: 20,
      }, // NOR2 HOME O0_5 base 0.8166
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.44,
        minSampleN: 20,
      }, // NOR2 HOME O1_5 base 0.4899 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.46,
        minSampleN: 20,
      }, // NOR2 HOME U1_5 base 0.5101 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 20,
      }, // NOR2 HOME U2_5 base 0.7525
      {
        team: "HOME",
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.85,
        minSampleN: 20,
      }, // NOR2 HOME U3_5 base 0.8957
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 20,
      }, // NOR2 AWAY O0_5 base 0.7437
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 20,
      }, // NOR2 AWAY U1_5 base 0.5942
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.77,
        minSampleN: 20,
      }, // NOR2 AWAY U2_5 base 0.8191
    ],
  },
  PL: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 20,
      }, // PL HOME O0_5 base 0.7849
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.43,
        minSampleN: 20,
      }, // PL HOME O1_5 base 0.4803 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.47,
        minSampleN: 20,
      }, // PL HOME U1_5 base 0.5197 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 20,
      }, // PL HOME U2_5 base 0.7724
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 20,
      }, // PL AWAY O0_5 base 0.7309
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.57,
        minSampleN: 20,
      }, // PL AWAY U1_5 base 0.6184
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 20,
      }, // PL AWAY U2_5 base 0.852
    ],
  },
  POL1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 20,
      }, // POL1 HOME O0_5 base 0.7865
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.41,
        minSampleN: 20,
      }, // POL1 HOME O1_5 base 0.4553 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.49,
        minSampleN: 20,
      }, // POL1 HOME U1_5 base 0.5447 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 20,
      }, // POL1 HOME U2_5 base 0.7974
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 20,
      }, // POL1 AWAY O0_5 base 0.6993
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 20,
      }, // POL1 AWAY U1_5 base 0.6754
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.84,
        minSampleN: 20,
      }, // POL1 AWAY U2_5 base 0.89
    ],
  },
  POL2: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 20,
      }, // POL2 HOME O0_5 base 0.7708
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.4,
        minSampleN: 20,
      }, // POL2 HOME O1_5 base 0.4508 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 20,
      }, // POL2 HOME U1_5 base 0.5492 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.77,
        minSampleN: 20,
      }, // POL2 HOME U2_5 base 0.8205
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 20,
      }, // POL2 AWAY O0_5 base 0.7308
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.59,
        minSampleN: 20,
      }, // POL2 AWAY U1_5 base 0.6422
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 20,
      }, // POL2 AWAY U2_5 base 0.8659
    ],
  },
  POR: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 20,
      }, // POR HOME O0_5 base 0.7576
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.52,
        minSampleN: 20,
      }, // POR HOME U1_5 base 0.5747
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 20,
      }, // POR HOME U2_5 base 0.7987
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 20,
      }, // POR AWAY O0_5 base 0.6797
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.6,
        minSampleN: 20,
      }, // POR AWAY U1_5 base 0.6526
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 20,
      }, // POR AWAY U2_5 base 0.8712
    ],
  },
  RUS1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 20,
      }, // RUS1 HOME O0_5 base 0.7773
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.51,
        minSampleN: 20,
      }, // RUS1 HOME U1_5 base 0.5615
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.77,
        minSampleN: 20,
      }, // RUS1 HOME U2_5 base 0.8238
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.62,
        minSampleN: 20,
      }, // RUS1 AWAY O0_5 base 0.668
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 20,
      }, // RUS1 AWAY U1_5 base 0.6913
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.83,
        minSampleN: 20,
      }, // RUS1 AWAY U2_5 base 0.8839
    ],
  },
  SA: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 20,
      }, // SA HOME O0_5 base 0.7313
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.55,
        minSampleN: 20,
      }, // SA HOME U1_5 base 0.6023
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 20,
      }, // SA HOME U2_5 base 0.8499
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 20,
      }, // SA AWAY O0_5 base 0.6831
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.61,
        minSampleN: 20,
      }, // SA AWAY U1_5 base 0.6594
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.83,
        minSampleN: 20,
      }, // SA AWAY U2_5 base 0.8832
    ],
  },
  SCO1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 20,
      }, // SCO1 HOME O0_5 base 0.7849
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.43,
        minSampleN: 20,
      }, // SCO1 HOME O1_5 base 0.4786 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.47,
        minSampleN: 20,
      }, // SCO1 HOME U1_5 base 0.5214 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 20,
      }, // SCO1 HOME U2_5 base 0.7835
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 20,
      }, // SCO1 AWAY O0_5 base 0.6752
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.59,
        minSampleN: 20,
      }, // SCO1 AWAY U1_5 base 0.6353
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 20,
      }, // SCO1 AWAY U2_5 base 0.859
    ],
  },
  SP2: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 20,
      }, // SP2 HOME O0_5 base 0.7634
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 20,
      }, // SP2 HOME U1_5 base 0.5852
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 20,
      }, // SP2 HOME U2_5 base 0.8403
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.6,
        minSampleN: 20,
      }, // SP2 AWAY O0_5 base 0.6479
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.67,
        minSampleN: 20,
      }, // SP2 AWAY U1_5 base 0.7163
    ],
  },
  SRB1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 20,
      }, // SRB1 HOME O0_5 base 0.7635
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.51,
        minSampleN: 20,
      }, // SRB1 HOME U1_5 base 0.5628
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 20,
      }, // SRB1 HOME U2_5 base 0.7937
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 20,
      }, // SRB1 AWAY O0_5 base 0.6805
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.6,
        minSampleN: 20,
      }, // SRB1 AWAY U1_5 base 0.6536
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 20,
      }, // SRB1 AWAY U2_5 base 0.8475
    ],
  },
  SUI1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.77,
        minSampleN: 20,
      }, // SUI1 HOME O0_5 base 0.8217
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 20,
      }, // SUI1 HOME O1_5 base 0.4971 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 20,
      }, // SUI1 HOME U1_5 base 0.5029 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 20,
      }, // SUI1 HOME U2_5 base 0.7594
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 20,
      }, // SUI1 AWAY O0_5 base 0.7493
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.59,
        minSampleN: 20,
      }, // SUI1 AWAY U1_5 base 0.6435
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 20,
      }, // SUI1 AWAY U2_5 base 0.8565
    ],
  },
  SUI2: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 20,
      }, // SUI2 HOME O0_5 base 0.7844
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.41,
        minSampleN: 20,
      }, // SUI2 HOME O1_5 base 0.4572 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.49,
        minSampleN: 20,
      }, // SUI2 HOME U1_5 base 0.5428 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 20,
      }, // SUI2 HOME U2_5 base 0.7937
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 20,
      }, // SUI2 AWAY O0_5 base 0.7305
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 20,
      }, // SUI2 AWAY U1_5 base 0.5874
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.78,
        minSampleN: 20,
      }, // SUI2 AWAY U2_5 base 0.8271
    ],
  },
  SVN1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 20,
      }, // SVN1 HOME O0_5 base 0.7797
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 20,
      }, // SVN1 HOME U1_5 base 0.5536
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 20,
      }, // SVN1 HOME U2_5 base 0.795
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.67,
        minSampleN: 20,
      }, // SVN1 AWAY O0_5 base 0.7222
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.58,
        minSampleN: 20,
      }, // SVN1 AWAY U1_5 base 0.6341
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 20,
      }, // SVN1 AWAY U2_5 base 0.8372
    ],
  },
  SWE1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 20,
      }, // SWE1 HOME O0_5 base 0.7676
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 20,
      }, // SWE1 HOME U1_5 base 0.5543
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 20,
      }, // SWE1 HOME U2_5 base 0.7867
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 20,
      }, // SWE1 AWAY O0_5 base 0.705
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.58,
        minSampleN: 20,
      }, // SWE1 AWAY U1_5 base 0.6258
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 20,
      }, // SWE1 AWAY U2_5 base 0.8429
    ],
  },
  SWE2: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 20,
      }, // SWE2 HOME O0_5 base 0.7741
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 20,
      }, // SWE2 HOME O1_5 base 0.4657 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 20,
      }, // SWE2 HOME U1_5 base 0.5343 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 20,
      }, // SWE2 HOME U2_5 base 0.7906
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 20,
      }, // SWE2 AWAY O0_5 base 0.6954
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.58,
        minSampleN: 20,
      }, // SWE2 AWAY U1_5 base 0.6345
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.83,
        minSampleN: 20,
      }, // SWE2 AWAY U2_5 base 0.8845
    ],
  },
  TUR1: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 20,
      }, // TUR1 HOME O0_5 base 0.7811
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.41,
        minSampleN: 20,
      }, // TUR1 HOME O1_5 base 0.4611 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.49,
        minSampleN: 20,
      }, // TUR1 HOME U1_5 base 0.5389 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 20,
      }, // TUR1 HOME U2_5 base 0.7831
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 20,
      }, // TUR1 AWAY O0_5 base 0.6946
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.61,
        minSampleN: 20,
      }, // TUR1 AWAY U1_5 base 0.6644
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 20,
      }, // TUR1 AWAY U2_5 base 0.8609
    ],
  },
  TUR2: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 20,
      }, // TUR2 HOME O0_5 base 0.7391
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 20,
      }, // TUR2 HOME U1_5 base 0.5865
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 20,
      }, // TUR2 HOME U2_5 base 0.7956
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.59,
        minSampleN: 20,
      }, // TUR2 AWAY O0_5 base 0.6438
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 20,
      }, // TUR2 AWAY U1_5 base 0.7003
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 20,
      }, // TUR2 AWAY U2_5 base 0.8659
    ],
  },
  UCL: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 20,
      }, // UCL HOME O0_5 base 0.797
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 20,
      }, // UCL HOME O1_5 base 0.5025 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 20,
      }, // UCL HOME U1_5 base 0.4975 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 20,
      }, // UCL HOME U2_5 base 0.7431
      {
        team: "HOME",
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.83,
        minSampleN: 20,
      }, // UCL HOME U3_5 base 0.8759
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 20,
      }, // UCL AWAY O0_5 base 0.6892
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.58,
        minSampleN: 20,
      }, // UCL AWAY U1_5 base 0.6291
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.76,
        minSampleN: 20,
      }, // UCL AWAY U2_5 base 0.8145
    ],
  },
  UECL: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 20,
      }, // UECL HOME O0_5 base 0.7789
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 20,
      }, // UECL HOME O1_5 base 0.4699 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 20,
      }, // UECL HOME U1_5 base 0.5301 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 20,
      }, // UECL HOME U2_5 base 0.7662
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.62,
        minSampleN: 20,
      }, // UECL AWAY O0_5 base 0.6656
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 20,
      }, // UECL AWAY U1_5 base 0.6767
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 20,
      }, // UECL AWAY U2_5 base 0.8748
    ],
  },
  UEL: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 20,
      }, // UEL HOME O0_5 base 0.792
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.43,
        minSampleN: 20,
      }, // UEL HOME O1_5 base 0.4813 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.47,
        minSampleN: 20,
      }, // UEL HOME U1_5 base 0.5187 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 20,
      }, // UEL HOME U2_5 base 0.7656
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 20,
      }, // UEL AWAY O0_5 base 0.6755
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.62,
        minSampleN: 20,
      }, // UEL AWAY U1_5 base 0.6671
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 20,
      }, // UEL AWAY U2_5 base 0.8724
    ],
  },
  UNL: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 20,
      }, // UNL HOME O0_5 base 0.75
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 20,
      }, // UNL HOME U1_5 base 0.5851
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 20,
      }, // UNL HOME U2_5 base 0.7872
      {
        team: "HOME",
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.85,
        minSampleN: 20,
      }, // UNL HOME U3_5 base 0.8989
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.57,
        minSampleN: 20,
      }, // UNL AWAY O0_5 base 0.6223
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.6,
        minSampleN: 20,
      }, // UNL AWAY U1_5 base 0.6543
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 20,
      }, // UNL AWAY U2_5 base 0.8617
    ],
  },
  USA2: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 20,
      }, // USA2 HOME O0_5 base 0.7607
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.51,
        minSampleN: 20,
      }, // USA2 HOME U1_5 base 0.5566
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.76,
        minSampleN: 20,
      }, // USA2 HOME U2_5 base 0.8095
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 20,
      }, // USA2 AWAY O0_5 base 0.6841
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.62,
        minSampleN: 20,
      }, // USA2 AWAY U1_5 base 0.6669
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 20,
      }, // USA2 AWAY U2_5 base 0.8739
    ],
  },
  WC: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 20,
      }, // WC HOME O0_5 base 0.7576
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 20,
      }, // WC HOME U1_5 base 0.5515
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 20,
      }, // WC HOME U2_5 base 0.7697
      {
        team: "HOME",
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.85,
        minSampleN: 20,
      }, // WC HOME U3_5 base 0.897
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.62,
        minSampleN: 20,
      }, // WC AWAY O0_5 base 0.6727
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 20,
      }, // WC AWAY U1_5 base 0.6909
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 20,
      }, // WC AWAY U2_5 base 0.8727
    ],
  },
  WCQAF: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 20,
      }, // WCQAF HOME O0_5 base 0.677
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.61,
        minSampleN: 20,
      }, // WCQAF HOME U1_5 base 0.6556
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.77,
        minSampleN: 20,
      }, // WCQAF HOME U2_5 base 0.8219
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.57,
        minSampleN: 20,
      }, // WCQAF AWAY O0_5 base 0.62
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 20,
      }, // WCQAF AWAY U1_5 base 0.7363
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 20,
      }, // WCQAF AWAY U2_5 base 0.8694
    ],
  },
  WCQAS: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 20,
      }, // WCQAS HOME O0_5 base 0.6754
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.55,
        minSampleN: 20,
      }, // WCQAS HOME U1_5 base 0.5987
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 20,
      }, // WCQAS HOME U2_5 base 0.7522
      {
        team: "HOME",
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 20,
      }, // WCQAS HOME U3_5 base 0.8553
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.55,
        minSampleN: 20,
      }, // WCQAS AWAY O0_5 base 0.5987
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 20,
      }, // WCQAS AWAY U1_5 base 0.6974
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 20,
      }, // WCQAS AWAY U2_5 base 0.8487
    ],
  },
  WCQCA: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.66,
        minSampleN: 20,
      }, // WCQCA HOME O0_5 base 0.711
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.53,
        minSampleN: 20,
      }, // WCQCA HOME U1_5 base 0.578
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 20,
      }, // WCQCA HOME U2_5 base 0.7431
      {
        team: "HOME",
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 20,
      }, // WCQCA HOME U3_5 base 0.8578
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 20,
      }, // WCQCA AWAY O0_5 base 0.5459 (mid-band, both sides)
      {
        team: "AWAY",
        line: 0.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.4,
        minSampleN: 20,
      }, // WCQCA AWAY U0_5 base 0.4541 (mid-band, both sides)
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.67,
        minSampleN: 20,
      }, // WCQCA AWAY U1_5 base 0.7202
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.78,
        minSampleN: 20,
      }, // WCQCA AWAY U2_5 base 0.8257
    ],
  },
  WCQE: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.66,
        minSampleN: 20,
      }, // WCQE HOME O0_5 base 0.7056
      {
        team: "HOME",
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 20,
      }, // WCQE HOME O1_5 base 0.4654 (mid-band, both sides)
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 20,
      }, // WCQE HOME U1_5 base 0.5346 (mid-band, both sides)
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 20,
      }, // WCQE HOME U2_5 base 0.7554
      {
        team: "HOME",
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 20,
      }, // WCQE HOME U3_5 base 0.855
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.62,
        minSampleN: 20,
      }, // WCQE AWAY O0_5 base 0.6732
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.59,
        minSampleN: 20,
      }, // WCQE AWAY U1_5 base 0.6364
      {
        team: "AWAY",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.77,
        minSampleN: 20,
      }, // WCQE AWAY U2_5 base 0.816
      {
        team: "AWAY",
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.85,
        minSampleN: 20,
      }, // WCQE AWAY U3_5 base 0.8983
    ],
  },
  WCQSA: {
    lines: [
      {
        team: "HOME",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.67,
        minSampleN: 20,
      }, // WCQSA HOME O0_5 base 0.7151
      {
        team: "HOME",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.53,
        minSampleN: 20,
      }, // WCQSA HOME U1_5 base 0.5754
      {
        team: "HOME",
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 20,
      }, // WCQSA HOME U2_5 base 0.7709
      {
        team: "HOME",
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.85,
        minSampleN: 20,
      }, // WCQSA HOME U3_5 base 0.8994
      {
        team: "AWAY",
        line: 0.5,
        side: "OVER",
        enabled: true,
        threshold: 0.44,
        minSampleN: 20,
      }, // WCQSA AWAY O0_5 base 0.486 (mid-band, both sides)
      {
        team: "AWAY",
        line: 0.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.46,
        minSampleN: 20,
      }, // WCQSA AWAY U0_5 base 0.514 (mid-band, both sides)
      {
        team: "AWAY",
        line: 1.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 20,
      }, // WCQSA AWAY U1_5 base 0.8045
    ],
  },
};

// Resolve the enabled TEAM_TOTAL line configs for a league (empty when none).
export function getTeamTotalLineConfigs(
  competitionCode: string | null | undefined,
): readonly TeamTotalLineConfig[] {
  if (competitionCode == null) return [];
  const leagueConfig = TEAM_TOTAL_CONFIG[competitionCode];
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
  // CLEAN_SHEET / WIN_EITHER_HALF live in their own side tables (like
  // BTTS_NO_CONFIG) — structurally-derived OBSERVATION thresholds, not part
  // of the backtested CHANNEL_STRATEGY_CONFIG table above.
  if (channel === "CLEAN_SHEET") {
    return (
      (competitionCode != null
        ? CLEAN_SHEET_CONFIG[competitionCode]
        : undefined) ?? CLEAN_SHEET_DEFAULT
    );
  }
  if (channel === "WIN_EITHER_HALF") {
    return (
      (competitionCode != null
        ? WIN_EITHER_HALF_CONFIG[competitionCode]
        : undefined) ?? WIN_EITHER_HALF_DEFAULT
    );
  }

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
