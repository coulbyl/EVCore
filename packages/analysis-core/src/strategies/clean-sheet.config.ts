import type { ChannelStrategyLeagueConfig } from "./channel-strategy-config.types";

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

export const CLEAN_SHEET_DEFAULT: ChannelStrategyLeagueConfig = {
  enabled: false,
  threshold: 0.99,
  minSampleN: 20,
};
