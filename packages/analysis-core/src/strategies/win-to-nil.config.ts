import type { ChannelStrategyLeagueConfig } from "./channel-strategy-config.types";

// WIN_TO_NIL — side wins AND the opponent scores zero. Independent per side
// (unlike dnbHome/dnbAway, both can be false at once — a draw or a game where
// both teams score), same shape as CLEAN_SHEET. No walk-forward calibration —
// OBSERVATION launch derived directly from settled fixtures (docker exec
// evcore-postgres psql): win_to_nil_home rate = count(home wins AND away
// scores 0) / count(settled fixtures) per league (and symmetrically for
// away). threshold = home base rate − 0.05, same rule as CLEAN_SHEET_CONFIG
// (home is structurally the stronger/more reliable signal across every
// league) — both sides still evaluated at runtime (decideCleanSheet-style
// argmax), AWAY can still surface on an exceptional match. Never staked.
// Derived 2026-08-16, all active leagues with n ≥ 50.
export const WIN_TO_NIL_CONFIG: Record<string, ChannelStrategyLeagueConfig> = {
  ARG1: { enabled: true, threshold: 0.24, minSampleN: 20 }, // WTN home base 0.2914, away 0.1643, n=1582
  ARG2: { enabled: true, threshold: 0.26, minSampleN: 20 }, // WTN home base 0.3132, away 0.1457, n=2471
  AUS1: { enabled: true, threshold: 0.13, minSampleN: 20 }, // WTN home base 0.1811, away 0.1575, n=508
  AUT1: { enabled: true, threshold: 0.18, minSampleN: 20 }, // WTN home base 0.2324, away 0.1622, n=598
  BEL1: { enabled: true, threshold: 0.18, minSampleN: 20 }, // WTN home base 0.2297, away 0.1507, n=962
  BL1: { enabled: true, threshold: 0.15, minSampleN: 20 }, // WTN home base 0.1959, away 0.1504, n=924
  BRA1: { enabled: true, threshold: 0.23, minSampleN: 20 }, // WTN home base 0.2799, away 0.1487, n=1197
  BRA2: { enabled: true, threshold: 0.25, minSampleN: 20 }, // WTN home base 0.3038, away 0.1449, n=1353
  CH: { enabled: true, threshold: 0.19, minSampleN: 20 }, // WTN home base 0.2376, away 0.1614, n=1679
  CHI1: { enabled: true, threshold: 0.2, minSampleN: 20 }, // WTN home base 0.2503, away 0.1657, n=863
  CHI2: { enabled: true, threshold: 0.18, minSampleN: 20 }, // WTN home base 0.2268, away 0.1680, n=613
  CHN2: { enabled: true, threshold: 0.2, minSampleN: 20 }, // WTN home base 0.2477, away 0.1493, n=864
  CSL: { enabled: true, threshold: 0.16, minSampleN: 20 }, // WTN home base 0.2126, away 0.1396, n=795
  CZE1: { enabled: true, threshold: 0.21, minSampleN: 20 }, // WTN home base 0.2560, away 0.1619, n=840
  D2: { enabled: true, threshold: 0.16, minSampleN: 20 }, // WTN home base 0.2132, away 0.1354, n=938
  D3: { enabled: true, threshold: 0.16, minSampleN: 20 }, // WTN home base 0.2092, away 0.1296, n=1157
  DEN1: { enabled: true, threshold: 0.15, minSampleN: 20 }, // WTN home base 0.2034, away 0.1395, n=595
  EL1: { enabled: true, threshold: 0.19, minSampleN: 20 }, // WTN home base 0.2400, away 0.1717, n=1683
  EL2: { enabled: true, threshold: 0.19, minSampleN: 20 }, // WTN home base 0.2368, away 0.1648, n=1681
  ERD: { enabled: true, threshold: 0.18, minSampleN: 20 }, // WTN home base 0.2319, away 0.1398, n=966
  EST1: { enabled: true, threshold: 0.18, minSampleN: 20 }, // WTN home base 0.2296, away 0.2007, n=588
  F2: { enabled: true, threshold: 0.19, minSampleN: 20 }, // WTN home base 0.2389, away 0.1681, n=1017
  FIN1: { enabled: true, threshold: 0.15, minSampleN: 20 }, // WTN home base 0.2031, away 0.1706, n=586
  FIN2: { enabled: true, threshold: 0.14, minSampleN: 20 }, // WTN home base 0.1940, away 0.1721, n=366
  FRI: { enabled: true, threshold: 0.22, minSampleN: 20 }, // WTN home base 0.2665, away 0.1519, n=349
  GRE1: { enabled: true, threshold: 0.2, minSampleN: 20 }, // WTN home base 0.2472, away 0.1798, n=712
  I2: { enabled: true, threshold: 0.17, minSampleN: 20 }, // WTN home base 0.2248, away 0.1393, n=1170
  IRL1: { enabled: true, threshold: 0.18, minSampleN: 20 }, // WTN home base 0.2334, away 0.1566, n=677
  ISL1: { enabled: true, threshold: 0.15, minSampleN: 20 }, // WTN home base 0.1982, away 0.1273, n=550
  J1: { enabled: true, threshold: 0.18, minSampleN: 20 }, // WTN home base 0.2317, away 0.1750, n=1286
  KOR1: { enabled: true, threshold: 0.17, minSampleN: 20 }, // WTN home base 0.2216, away 0.1514, n=740
  KOR2: { enabled: true, threshold: 0.14, minSampleN: 20 }, // WTN home base 0.1948, away 0.1763, n=919
  KSA1: { enabled: true, threshold: 0.16, minSampleN: 20 }, // WTN home base 0.2143, away 0.1591, n=924
  L1: { enabled: true, threshold: 0.18, minSampleN: 20 }, // WTN home base 0.2346, away 0.1535, n=925
  LAT1: { enabled: true, threshold: 0.21, minSampleN: 20 }, // WTN home base 0.2583, away 0.1850, n=600
  LL: { enabled: true, threshold: 0.2, minSampleN: 20 }, // WTN home base 0.2535, away 0.1535, n=1140
  MLS: { enabled: true, threshold: 0.15, minSampleN: 20 }, // WTN home base 0.2008, away 0.1195, n=1180
  MX1: { enabled: true, threshold: 0.19, minSampleN: 20 }, // WTN home base 0.2411, away 0.1273, n=1037
  NOR1: { enabled: true, threshold: 0.18, minSampleN: 20 }, // WTN home base 0.2339, away 0.1634, n=808
  NOR2: { enabled: true, threshold: 0.15, minSampleN: 20 }, // WTN home base 0.2029, away 0.1349, n=823
  PL: { enabled: true, threshold: 0.17, minSampleN: 20 }, // WTN home base 0.2184, away 0.1645, n=1520
  POL1: { enabled: true, threshold: 0.18, minSampleN: 20 }, // WTN home base 0.2274, away 0.1403, n=941
  POL2: { enabled: true, threshold: 0.15, minSampleN: 20 }, // WTN home base 0.2021, away 0.1634, n=955
  POR: { enabled: true, threshold: 0.21, minSampleN: 20 }, // WTN home base 0.2567, away 0.1775, n=935
  RUS1: { enabled: true, threshold: 0.2, minSampleN: 20 }, // WTN home base 0.2507, away 0.1464, n=758
  SA: { enabled: true, threshold: 0.18, minSampleN: 20 }, // WTN home base 0.2344, away 0.1861, n=1139
  SCO1: { enabled: true, threshold: 0.22, minSampleN: 20 }, // WTN home base 0.2661, away 0.1541, n=714
  SP2: { enabled: true, threshold: 0.21, minSampleN: 20 }, // WTN home base 0.2557, away 0.1410, n=1404
  SRB1: { enabled: true, threshold: 0.19, minSampleN: 20 }, // WTN home base 0.2365, away 0.1496, n=909
  SUI1: { enabled: true, threshold: 0.15, minSampleN: 20 }, // WTN home base 0.2040, away 0.1331, n=706
  SUI2: { enabled: true, threshold: 0.16, minSampleN: 20 }, // WTN home base 0.2080, away 0.1533, n=548
  SVN1: { enabled: true, threshold: 0.17, minSampleN: 20 }, // WTN home base 0.2206, away 0.1589, n=535
  SWE1: { enabled: true, threshold: 0.19, minSampleN: 20 }, // WTN home base 0.2393, away 0.1767, n=815
  SWE2: { enabled: true, threshold: 0.18, minSampleN: 20 }, // WTN home base 0.2315, away 0.1503, n=825
  TUR1: { enabled: true, threshold: 0.18, minSampleN: 20 }, // WTN home base 0.2264, away 0.1399, n=1029
  TUR2: { enabled: true, threshold: 0.23, minSampleN: 20 }, // WTN home base 0.2768, away 0.1815, n=1091
  UCL: { enabled: true, threshold: 0.22, minSampleN: 20 }, // WTN home base 0.2659, away 0.1518, n=850
  UECL: { enabled: true, threshold: 0.23, minSampleN: 20 }, // WTN home base 0.2782, away 0.1592, n=1445
  UEL: { enabled: true, threshold: 0.21, minSampleN: 20 }, // WTN home base 0.2636, away 0.1481, n=770
  UNL: { enabled: true, threshold: 0.24, minSampleN: 20 }, // WTN home base 0.2926, away 0.1649, n=188
  USA2: { enabled: true, threshold: 0.19, minSampleN: 20 }, // WTN home base 0.2379, away 0.1584, n=1446
  WC: { enabled: true, threshold: 0.18, minSampleN: 20 }, // WTN home base 0.2321, away 0.1488, n=168
  WCQAF: { enabled: true, threshold: 0.24, minSampleN: 20 }, // WTN home base 0.2922, away 0.2352, n=421
  WCQAS: { enabled: true, threshold: 0.27, minSampleN: 20 }, // WTN home base 0.3180, away 0.2412, n=456
  WCQCA: { enabled: true, threshold: 0.32, minSampleN: 20 }, // WTN home base 0.3670, away 0.2018, n=218
  WCQE: { enabled: true, threshold: 0.23, minSampleN: 20 }, // WTN home base 0.2814, away 0.2489, n=462
  WCQSA: { enabled: true, threshold: 0.32, minSampleN: 20 }, // WTN home base 0.3687, away 0.1397, n=179
};

export const WIN_TO_NIL_DEFAULT: ChannelStrategyLeagueConfig = {
  enabled: false,
  threshold: 0.99,
  minSampleN: 20,
};
