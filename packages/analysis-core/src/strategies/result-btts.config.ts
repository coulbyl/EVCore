// ─────────────────────────────────────────────
// RESULT_BTTS — pre-combined result×BTTS pick (e.g. "HOME_YES"), priced
// against a genuine joint bookmaker odd (2026-08-16, OBSERVATION mode).
// Unlike RESULT_TOTAL_GOALS/OVER_UNDER_HT, no walk-forward shrinkage exists
// yet for this market — same situation TEAM_TOTAL was in at its 2026-07-18
// launch. Derived directly from settled fixtures (docker exec
// evcore-postgres psql, per CLAUDE.md's DB access rule): for every
// FINISHED fixture with a recorded score, joint rate = count(result side AND
// BTTS outcome) / count(all settled fixtures in that league). All 6
// (side, outcome) combos per league are included (both YES and NO — unlike
// TEAM_TOTAL's OVER/UNDER split, there's no uninformative "mid-band" to drop
// here since every combo is a distinct, independently priced bookmaker
// market), gated on two floors: league-level n≥50 settled fixtures, and
// per-pick n≥30 actual observations (a specific (side,outcome) can be much
// rarer than the league total — e.g. DRAW+YES in a low-scoring league).
//
// threshold = base rate × 0.85 (relative margin) — reuses RESULT_TOTAL_GOALS'
// rule, not TEAM_TOTAL's flat −0.05: these are joint probabilities running
// ~0.03–0.37 (same magnitude family as RESULT_TOTAL_GOALS), not marginals
// clustering near 0.5. Not itself ROI-backtested — pure OBSERVATION launch,
// same as TEAM_TOTAL's and RESULT_TOTAL_GOALS'/OVER_UNDER_HT's own thresholds
// at their respective launches.
// ─────────────────────────────────────────────

export type ResultBttsSide = "HOME" | "DRAW" | "AWAY";
export type ResultBttsOutcome = "YES" | "NO";

export type ResultBttsPickConfig = {
  side: ResultBttsSide;
  outcome: ResultBttsOutcome;
  threshold: number;
  enabled: boolean;
  minSampleN: number;
};

export type ResultBttsLeagueConfig = {
  picks: readonly ResultBttsPickConfig[];
};

export const RESULT_BTTS_CONFIG: Record<string, ResultBttsLeagueConfig> = {
  ARG1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1397,
        enabled: true,
        minSampleN: 260,
      }, // base 0.1643
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.0736,
        enabled: true,
        minSampleN: 137,
      }, // base 0.0866
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.122,
        enabled: true,
        minSampleN: 227,
      }, // base 0.1435
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1472,
        enabled: true,
        minSampleN: 274,
      }, // base 0.1732
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2477,
        enabled: true,
        minSampleN: 461,
      }, // base 0.2914
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1198,
        enabled: true,
        minSampleN: 223,
      }, // base 0.1410
    ],
  },
  ARG2: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1238,
        enabled: true,
        minSampleN: 360,
      }, // base 0.1457
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.0612,
        enabled: true,
        minSampleN: 178,
      }, // base 0.0720
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.1324,
        enabled: true,
        minSampleN: 385,
      }, // base 0.1558
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1421,
        enabled: true,
        minSampleN: 413,
      }, // base 0.1671
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2662,
        enabled: true,
        minSampleN: 774,
      }, // base 0.3132
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1242,
        enabled: true,
        minSampleN: 361,
      }, // base 0.1461
    ],
  },
  AUS1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1339,
        enabled: true,
        minSampleN: 80,
      }, // base 0.1575
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1673,
        enabled: true,
        minSampleN: 100,
      }, // base 0.1968
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1824,
        enabled: true,
        minSampleN: 109,
      }, // base 0.2146
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1539,
        enabled: true,
        minSampleN: 92,
      }, // base 0.1811
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.169,
        enabled: true,
        minSampleN: 101,
      }, // base 0.1988
    ],
  },
  AUT1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1379,
        enabled: true,
        minSampleN: 97,
      }, // base 0.1622
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1322,
        enabled: true,
        minSampleN: 93,
      }, // base 0.1555
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0682,
        enabled: true,
        minSampleN: 48,
      }, // base 0.0803
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.162,
        enabled: true,
        minSampleN: 114,
      }, // base 0.1906
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1976,
        enabled: true,
        minSampleN: 139,
      }, // base 0.2324
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1521,
        enabled: true,
        minSampleN: 107,
      }, // base 0.1789
    ],
  },
  BEL1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1281,
        enabled: true,
        minSampleN: 145,
      }, // base 0.1507
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.129,
        enabled: true,
        minSampleN: 146,
      }, // base 0.1518
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0636,
        enabled: true,
        minSampleN: 72,
      }, // base 0.0748
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1643,
        enabled: true,
        minSampleN: 186,
      }, // base 0.1933
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1953,
        enabled: true,
        minSampleN: 221,
      }, // base 0.2297
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1696,
        enabled: true,
        minSampleN: 192,
      }, // base 0.1996
    ],
  },
  BL1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1279,
        enabled: true,
        minSampleN: 139,
      }, // base 0.1504
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.149,
        enabled: true,
        minSampleN: 162,
      }, // base 0.1753
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0442,
        enabled: true,
        minSampleN: 48,
      }, // base 0.0519
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1729,
        enabled: true,
        minSampleN: 188,
      }, // base 0.2035
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1665,
        enabled: true,
        minSampleN: 181,
      }, // base 0.1959
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1895,
        enabled: true,
        minSampleN: 206,
      }, // base 0.2229
    ],
  },
  BRA1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1264,
        enabled: true,
        minSampleN: 178,
      }, // base 0.1487
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.0916,
        enabled: true,
        minSampleN: 129,
      }, // base 0.1078
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0632,
        enabled: true,
        minSampleN: 89,
      }, // base 0.0744
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1612,
        enabled: true,
        minSampleN: 227,
      }, // base 0.1896
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2379,
        enabled: true,
        minSampleN: 335,
      }, // base 0.2799
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1697,
        enabled: true,
        minSampleN: 239,
      }, // base 0.1997
    ],
  },
  BRA2: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1231,
        enabled: true,
        minSampleN: 196,
      }, // base 0.1449
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.0829,
        enabled: true,
        minSampleN: 132,
      }, // base 0.0976
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0842,
        enabled: true,
        minSampleN: 134,
      }, // base 0.0990
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1583,
        enabled: true,
        minSampleN: 252,
      }, // base 0.1863
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2582,
        enabled: true,
        minSampleN: 411,
      }, // base 0.3038
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1432,
        enabled: true,
        minSampleN: 228,
      }, // base 0.1685
    ],
  },
  CH: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1372,
        enabled: true,
        minSampleN: 271,
      }, // base 0.1614
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1185,
        enabled: true,
        minSampleN: 234,
      }, // base 0.1394
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0592,
        enabled: true,
        minSampleN: 117,
      }, // base 0.0697
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.162,
        enabled: true,
        minSampleN: 320,
      }, // base 0.1906
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.202,
        enabled: true,
        minSampleN: 399,
      }, // base 0.2376
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1711,
        enabled: true,
        minSampleN: 338,
      }, // base 0.2013
    ],
  },
  CHI1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1408,
        enabled: true,
        minSampleN: 143,
      }, // base 0.1657
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.128,
        enabled: true,
        minSampleN: 130,
      }, // base 0.1506
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0424,
        enabled: true,
        minSampleN: 43,
      }, // base 0.0498
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1468,
        enabled: true,
        minSampleN: 149,
      }, // base 0.1727
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2127,
        enabled: true,
        minSampleN: 216,
      }, // base 0.2503
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1793,
        enabled: true,
        minSampleN: 182,
      }, // base 0.2109
    ],
  },
  CHI2: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1428,
        enabled: true,
        minSampleN: 103,
      }, // base 0.1680
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1359,
        enabled: true,
        minSampleN: 98,
      }, // base 0.1599
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0638,
        enabled: true,
        minSampleN: 46,
      }, // base 0.0750
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.147,
        enabled: true,
        minSampleN: 106,
      }, // base 0.1729
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1927,
        enabled: true,
        minSampleN: 139,
      }, // base 0.2268
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1678,
        enabled: true,
        minSampleN: 121,
      }, // base 0.1974
    ],
  },
  CHN2: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1269,
        enabled: true,
        minSampleN: 129,
      }, // base 0.1493
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1053,
        enabled: true,
        minSampleN: 107,
      }, // base 0.1238
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0787,
        enabled: true,
        minSampleN: 80,
      }, // base 0.0926
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1741,
        enabled: true,
        minSampleN: 177,
      }, // base 0.2049
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2105,
        enabled: true,
        minSampleN: 214,
      }, // base 0.2477
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1545,
        enabled: true,
        minSampleN: 157,
      }, // base 0.1817
    ],
  },
  CSL: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1187,
        enabled: true,
        minSampleN: 111,
      }, // base 0.1396
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1262,
        enabled: true,
        minSampleN: 118,
      }, // base 0.1484
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0438,
        enabled: true,
        minSampleN: 41,
      }, // base 0.0516
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1689,
        enabled: true,
        minSampleN: 158,
      }, // base 0.1987
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1807,
        enabled: true,
        minSampleN: 169,
      }, // base 0.2126
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.2117,
        enabled: true,
        minSampleN: 198,
      }, // base 0.2491
    ],
  },
  CZE1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1376,
        enabled: true,
        minSampleN: 136,
      }, // base 0.1619
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1295,
        enabled: true,
        minSampleN: 128,
      }, // base 0.1524
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0658,
        enabled: true,
        minSampleN: 65,
      }, // base 0.0774
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1356,
        enabled: true,
        minSampleN: 134,
      }, // base 0.1595
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2176,
        enabled: true,
        minSampleN: 215,
      }, // base 0.2560
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1639,
        enabled: true,
        minSampleN: 162,
      }, // base 0.1929
    ],
  },
  D2: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1151,
        enabled: true,
        minSampleN: 127,
      }, // base 0.1354
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1468,
        enabled: true,
        minSampleN: 162,
      }, // base 0.1727
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0471,
        enabled: true,
        minSampleN: 52,
      }, // base 0.0554
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1676,
        enabled: true,
        minSampleN: 185,
      }, // base 0.1972
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1812,
        enabled: true,
        minSampleN: 200,
      }, // base 0.2132
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1921,
        enabled: true,
        minSampleN: 212,
      }, // base 0.2260
    ],
  },
  D3: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1102,
        enabled: true,
        minSampleN: 150,
      }, // base 0.1296
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1403,
        enabled: true,
        minSampleN: 191,
      }, // base 0.1651
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.05,
        enabled: true,
        minSampleN: 68,
      }, // base 0.0588
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1616,
        enabled: true,
        minSampleN: 220,
      }, // base 0.1901
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1778,
        enabled: true,
        minSampleN: 242,
      }, // base 0.2092
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.2101,
        enabled: true,
        minSampleN: 286,
      }, // base 0.2472
    ],
  },
  DEN1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1186,
        enabled: true,
        minSampleN: 83,
      }, // base 0.1395
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1514,
        enabled: true,
        minSampleN: 106,
      }, // base 0.1782
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0443,
        enabled: true,
        minSampleN: 31,
      }, // base 0.0521
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1729,
        enabled: true,
        minSampleN: 121,
      }, // base 0.2034
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1729,
        enabled: true,
        minSampleN: 121,
      }, // base 0.2034
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.19,
        enabled: true,
        minSampleN: 133,
      }, // base 0.2235
    ],
  },
  EL1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.146,
        enabled: true,
        minSampleN: 289,
      }, // base 0.1717
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1232,
        enabled: true,
        minSampleN: 244,
      }, // base 0.1450
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0596,
        enabled: true,
        minSampleN: 118,
      }, // base 0.0701
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1495,
        enabled: true,
        minSampleN: 296,
      }, // base 0.1759
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.204,
        enabled: true,
        minSampleN: 404,
      }, // base 0.2400
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1677,
        enabled: true,
        minSampleN: 332,
      }, // base 0.1973
    ],
  },
  EL2: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1401,
        enabled: true,
        minSampleN: 277,
      }, // base 0.1648
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1269,
        enabled: true,
        minSampleN: 251,
      }, // base 0.1493
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0571,
        enabled: true,
        minSampleN: 113,
      }, // base 0.0672
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1603,
        enabled: true,
        minSampleN: 317,
      }, // base 0.1886
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2012,
        enabled: true,
        minSampleN: 398,
      }, // base 0.2368
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1643,
        enabled: true,
        minSampleN: 325,
      }, // base 0.1933
    ],
  },
  ERD: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1188,
        enabled: true,
        minSampleN: 135,
      }, // base 0.1398
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1408,
        enabled: true,
        minSampleN: 160,
      }, // base 0.1656
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0343,
        enabled: true,
        minSampleN: 39,
      }, // base 0.0404
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1804,
        enabled: true,
        minSampleN: 205,
      }, // base 0.2122
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1971,
        enabled: true,
        minSampleN: 224,
      }, // base 0.2319
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1786,
        enabled: true,
        minSampleN: 203,
      }, // base 0.2101
    ],
  },
  EST1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1706,
        enabled: true,
        minSampleN: 118,
      }, // base 0.2007
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1474,
        enabled: true,
        minSampleN: 102,
      }, // base 0.1735
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0491,
        enabled: true,
        minSampleN: 34,
      }, // base 0.0578
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1301,
        enabled: true,
        minSampleN: 90,
      }, // base 0.1531
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1952,
        enabled: true,
        minSampleN: 135,
      }, // base 0.2296
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1576,
        enabled: true,
        minSampleN: 109,
      }, // base 0.1854
    ],
  },
  F2: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1429,
        enabled: true,
        minSampleN: 171,
      }, // base 0.1681
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.112,
        enabled: true,
        minSampleN: 134,
      }, // base 0.1318
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0844,
        enabled: true,
        minSampleN: 101,
      }, // base 0.0993
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1529,
        enabled: true,
        minSampleN: 183,
      }, // base 0.1799
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2031,
        enabled: true,
        minSampleN: 243,
      }, // base 0.2389
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1546,
        enabled: true,
        minSampleN: 185,
      }, // base 0.1819
    ],
  },
  FIN1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1451,
        enabled: true,
        minSampleN: 100,
      }, // base 0.1706
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1291,
        enabled: true,
        minSampleN: 89,
      }, // base 0.1519
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0508,
        enabled: true,
        minSampleN: 35,
      }, // base 0.0597
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1494,
        enabled: true,
        minSampleN: 103,
      }, // base 0.1758
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1726,
        enabled: true,
        minSampleN: 119,
      }, // base 0.2031
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.2031,
        enabled: true,
        minSampleN: 140,
      }, // base 0.2389
    ],
  },
  FIN2: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1463,
        enabled: true,
        minSampleN: 63,
      }, // base 0.1721
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1324,
        enabled: true,
        minSampleN: 57,
      }, // base 0.1557
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1602,
        enabled: true,
        minSampleN: 69,
      }, // base 0.1885
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1649,
        enabled: true,
        minSampleN: 71,
      }, // base 0.1940
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1974,
        enabled: true,
        minSampleN: 85,
      }, // base 0.2322
    ],
  },
  FRI: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1291,
        enabled: true,
        minSampleN: 53,
      }, // base 0.1519
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.0974,
        enabled: true,
        minSampleN: 40,
      }, // base 0.1146
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1413,
        enabled: true,
        minSampleN: 58,
      }, // base 0.1662
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2265,
        enabled: true,
        minSampleN: 93,
      }, // base 0.2665
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1851,
        enabled: true,
        minSampleN: 76,
      }, // base 0.2178
    ],
  },
  GRE1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1528,
        enabled: true,
        minSampleN: 128,
      }, // base 0.1798
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1206,
        enabled: true,
        minSampleN: 101,
      }, // base 0.1419
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0597,
        enabled: true,
        minSampleN: 50,
      }, // base 0.0702
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1564,
        enabled: true,
        minSampleN: 131,
      }, // base 0.1840
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2101,
        enabled: true,
        minSampleN: 176,
      }, // base 0.2472
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1504,
        enabled: true,
        minSampleN: 126,
      }, // base 0.1770
    ],
  },
  I2: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1184,
        enabled: true,
        minSampleN: 163,
      }, // base 0.1393
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1112,
        enabled: true,
        minSampleN: 153,
      }, // base 0.1308
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0792,
        enabled: true,
        minSampleN: 109,
      }, // base 0.0932
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.194,
        enabled: true,
        minSampleN: 267,
      }, // base 0.2282
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1911,
        enabled: true,
        minSampleN: 263,
      }, // base 0.2248
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1562,
        enabled: true,
        minSampleN: 215,
      }, // base 0.1838
    ],
  },
  IRL1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1331,
        enabled: true,
        minSampleN: 106,
      }, // base 0.1566
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1105,
        enabled: true,
        minSampleN: 88,
      }, // base 0.1300
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0816,
        enabled: true,
        minSampleN: 65,
      }, // base 0.0960
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1657,
        enabled: true,
        minSampleN: 132,
      }, // base 0.1950
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1984,
        enabled: true,
        minSampleN: 158,
      }, // base 0.2334
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1607,
        enabled: true,
        minSampleN: 128,
      }, // base 0.1891
    ],
  },
  ISL1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1082,
        enabled: true,
        minSampleN: 70,
      }, // base 0.1273
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1345,
        enabled: true,
        minSampleN: 87,
      }, // base 0.1582
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1654,
        enabled: true,
        minSampleN: 107,
      }, // base 0.1945
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1685,
        enabled: true,
        minSampleN: 109,
      }, // base 0.1982
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.2473,
        enabled: true,
        minSampleN: 160,
      }, // base 0.2909
    ],
  },
  J1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1487,
        enabled: true,
        minSampleN: 225,
      }, // base 0.1750
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1269,
        enabled: true,
        minSampleN: 192,
      }, // base 0.1493
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0654,
        enabled: true,
        minSampleN: 99,
      }, // base 0.0770
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.16,
        enabled: true,
        minSampleN: 242,
      }, // base 0.1882
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.197,
        enabled: true,
        minSampleN: 298,
      }, // base 0.2317
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.152,
        enabled: true,
        minSampleN: 230,
      }, // base 0.1788
    ],
  },
  KOR1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1286,
        enabled: true,
        minSampleN: 112,
      }, // base 0.1514
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1355,
        enabled: true,
        minSampleN: 118,
      }, // base 0.1595
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0701,
        enabled: true,
        minSampleN: 61,
      }, // base 0.0824
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1654,
        enabled: true,
        minSampleN: 144,
      }, // base 0.1946
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1884,
        enabled: true,
        minSampleN: 164,
      }, // base 0.2216
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.162,
        enabled: true,
        minSampleN: 141,
      }, // base 0.1905
    ],
  },
  KOR2: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1498,
        enabled: true,
        minSampleN: 162,
      }, // base 0.1763
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1452,
        enabled: true,
        minSampleN: 157,
      }, // base 0.1708
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0795,
        enabled: true,
        minSampleN: 86,
      }, // base 0.0936
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1683,
        enabled: true,
        minSampleN: 182,
      }, // base 0.1980
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1656,
        enabled: true,
        minSampleN: 179,
      }, // base 0.1948
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1415,
        enabled: true,
        minSampleN: 153,
      }, // base 0.1665
    ],
  },
  KSA1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1352,
        enabled: true,
        minSampleN: 147,
      }, // base 0.1591
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1591,
        enabled: true,
        minSampleN: 173,
      }, // base 0.1872
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0469,
        enabled: true,
        minSampleN: 51,
      }, // base 0.0552
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1389,
        enabled: true,
        minSampleN: 151,
      }, // base 0.1634
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1821,
        enabled: true,
        minSampleN: 198,
      }, // base 0.2143
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1877,
        enabled: true,
        minSampleN: 204,
      }, // base 0.2208
    ],
  },
  L1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1305,
        enabled: true,
        minSampleN: 142,
      }, // base 0.1535
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1434,
        enabled: true,
        minSampleN: 156,
      }, // base 0.1686
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0606,
        enabled: true,
        minSampleN: 66,
      }, // base 0.0714
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1424,
        enabled: true,
        minSampleN: 155,
      }, // base 0.1676
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1994,
        enabled: true,
        minSampleN: 217,
      }, // base 0.2346
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1737,
        enabled: true,
        minSampleN: 189,
      }, // base 0.2043
    ],
  },
  LAT1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1573,
        enabled: true,
        minSampleN: 111,
      }, // base 0.1850
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1303,
        enabled: true,
        minSampleN: 92,
      }, // base 0.1533
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0524,
        enabled: true,
        minSampleN: 37,
      }, // base 0.0617
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1275,
        enabled: true,
        minSampleN: 90,
      }, // base 0.1500
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2196,
        enabled: true,
        minSampleN: 155,
      }, // base 0.2583
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1629,
        enabled: true,
        minSampleN: 115,
      }, // base 0.1917
    ],
  },
  LL: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1305,
        enabled: true,
        minSampleN: 175,
      }, // base 0.1535
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1089,
        enabled: true,
        minSampleN: 146,
      }, // base 0.1281
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.05,
        enabled: true,
        minSampleN: 67,
      }, // base 0.0588
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1715,
        enabled: true,
        minSampleN: 230,
      }, // base 0.2018
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2155,
        enabled: true,
        minSampleN: 289,
      }, // base 0.2535
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1737,
        enabled: true,
        minSampleN: 233,
      }, // base 0.2044
    ],
  },
  MLS: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1016,
        enabled: true,
        minSampleN: 141,
      }, // base 0.1195
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1542,
        enabled: true,
        minSampleN: 214,
      }, // base 0.1814
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0533,
        enabled: true,
        minSampleN: 74,
      }, // base 0.0627
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1599,
        enabled: true,
        minSampleN: 222,
      }, // base 0.1881
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1707,
        enabled: true,
        minSampleN: 237,
      }, // base 0.2008
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.2103,
        enabled: true,
        minSampleN: 292,
      }, // base 0.2475
    ],
  },
  MX1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1082,
        enabled: true,
        minSampleN: 132,
      }, // base 0.1273
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1311,
        enabled: true,
        minSampleN: 160,
      }, // base 0.1543
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0541,
        enabled: true,
        minSampleN: 66,
      }, // base 0.0636
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1566,
        enabled: true,
        minSampleN: 191,
      }, // base 0.1842
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2049,
        enabled: true,
        minSampleN: 250,
      }, // base 0.2411
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1951,
        enabled: true,
        minSampleN: 238,
      }, // base 0.2295
    ],
  },
  NOR1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1389,
        enabled: true,
        minSampleN: 132,
      }, // base 0.1634
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1357,
        enabled: true,
        minSampleN: 129,
      }, // base 0.1597
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0421,
        enabled: true,
        minSampleN: 40,
      }, // base 0.0495
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1294,
        enabled: true,
        minSampleN: 123,
      }, // base 0.1522
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1988,
        enabled: true,
        minSampleN: 189,
      }, // base 0.2339
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.2051,
        enabled: true,
        minSampleN: 195,
      }, // base 0.2413
    ],
  },
  NOR2: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1146,
        enabled: true,
        minSampleN: 111,
      }, // base 0.1349
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1622,
        enabled: true,
        minSampleN: 157,
      }, // base 0.1908
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0413,
        enabled: true,
        minSampleN: 40,
      }, // base 0.0486
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.158,
        enabled: true,
        minSampleN: 153,
      }, // base 0.1859
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1725,
        enabled: true,
        minSampleN: 167,
      }, // base 0.2029
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.2014,
        enabled: true,
        minSampleN: 195,
      }, // base 0.2369
    ],
  },
  PL: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1398,
        enabled: true,
        minSampleN: 250,
      }, // base 0.1645
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1275,
        enabled: true,
        minSampleN: 228,
      }, // base 0.1500
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0431,
        enabled: true,
        minSampleN: 77,
      }, // base 0.0507
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1616,
        enabled: true,
        minSampleN: 289,
      }, // base 0.1901
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1857,
        enabled: true,
        minSampleN: 332,
      }, // base 0.2184
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1924,
        enabled: true,
        minSampleN: 344,
      }, // base 0.2263
    ],
  },
  POL1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1192,
        enabled: true,
        minSampleN: 132,
      }, // base 0.1403
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1165,
        enabled: true,
        minSampleN: 129,
      }, // base 0.1371
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0623,
        enabled: true,
        minSampleN: 69,
      }, // base 0.0733
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1725,
        enabled: true,
        minSampleN: 191,
      }, // base 0.2030
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1933,
        enabled: true,
        minSampleN: 214,
      }, // base 0.2274
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1861,
        enabled: true,
        minSampleN: 206,
      }, // base 0.2189
    ],
  },
  POL2: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1388,
        enabled: true,
        minSampleN: 156,
      }, // base 0.1634
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1397,
        enabled: true,
        minSampleN: 157,
      }, // base 0.1644
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0552,
        enabled: true,
        minSampleN: 62,
      }, // base 0.0649
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1718,
        enabled: true,
        minSampleN: 193,
      }, // base 0.2021
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1718,
        enabled: true,
        minSampleN: 193,
      }, // base 0.2021
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1727,
        enabled: true,
        minSampleN: 194,
      }, // base 0.2031
    ],
  },
  POR: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1509,
        enabled: true,
        minSampleN: 166,
      }, // base 0.1775
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1145,
        enabled: true,
        minSampleN: 126,
      }, // base 0.1348
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0536,
        enabled: true,
        minSampleN: 59,
      }, // base 0.0631
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1691,
        enabled: true,
        minSampleN: 186,
      }, // base 0.1989
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2182,
        enabled: true,
        minSampleN: 240,
      }, // base 0.2567
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1436,
        enabled: true,
        minSampleN: 158,
      }, // base 0.1690
    ],
  },
  RUS1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1245,
        enabled: true,
        minSampleN: 111,
      }, // base 0.1464
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1166,
        enabled: true,
        minSampleN: 104,
      }, // base 0.1372
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0662,
        enabled: true,
        minSampleN: 59,
      }, // base 0.0778
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.166,
        enabled: true,
        minSampleN: 148,
      }, // base 0.1953
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2131,
        enabled: true,
        minSampleN: 190,
      }, // base 0.2507
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1637,
        enabled: true,
        minSampleN: 146,
      }, // base 0.1926
    ],
  },
  SA: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1582,
        enabled: true,
        minSampleN: 212,
      }, // base 0.1861
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1127,
        enabled: true,
        minSampleN: 151,
      }, // base 0.1326
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0701,
        enabled: true,
        minSampleN: 94,
      }, // base 0.0825
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1672,
        enabled: true,
        minSampleN: 224,
      }, // base 0.1967
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1993,
        enabled: true,
        minSampleN: 267,
      }, // base 0.2344
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1425,
        enabled: true,
        minSampleN: 191,
      }, // base 0.1677
    ],
  },
  SCO1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.131,
        enabled: true,
        minSampleN: 110,
      }, // base 0.1541
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1274,
        enabled: true,
        minSampleN: 107,
      }, // base 0.1499
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0512,
        enabled: true,
        minSampleN: 43,
      }, // base 0.0602
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1595,
        enabled: true,
        minSampleN: 134,
      }, // base 0.1877
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2262,
        enabled: true,
        minSampleN: 190,
      }, // base 0.2661
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1548,
        enabled: true,
        minSampleN: 130,
      }, // base 0.1821
    ],
  },
  SP2: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1199,
        enabled: true,
        minSampleN: 198,
      }, // base 0.1410
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1047,
        enabled: true,
        minSampleN: 173,
      }, // base 0.1232
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0817,
        enabled: true,
        minSampleN: 135,
      }, // base 0.0962
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.155,
        enabled: true,
        minSampleN: 256,
      }, // base 0.1823
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2173,
        enabled: true,
        minSampleN: 359,
      }, // base 0.2557
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1713,
        enabled: true,
        minSampleN: 283,
      }, // base 0.2016
    ],
  },
  SRB1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1272,
        enabled: true,
        minSampleN: 136,
      }, // base 0.1496
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1431,
        enabled: true,
        minSampleN: 153,
      }, // base 0.1683
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0739,
        enabled: true,
        minSampleN: 79,
      }, // base 0.0869
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1318,
        enabled: true,
        minSampleN: 141,
      }, // base 0.1551
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.201,
        enabled: true,
        minSampleN: 215,
      }, // base 0.2365
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.173,
        enabled: true,
        minSampleN: 185,
      }, // base 0.2035
    ],
  },
  SUI1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1132,
        enabled: true,
        minSampleN: 94,
      }, // base 0.1331
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1348,
        enabled: true,
        minSampleN: 112,
      }, // base 0.1586
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0373,
        enabled: true,
        minSampleN: 31,
      }, // base 0.0439
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1746,
        enabled: true,
        minSampleN: 145,
      }, // base 0.2054
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1734,
        enabled: true,
        minSampleN: 144,
      }, // base 0.2040
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.2167,
        enabled: true,
        minSampleN: 180,
      }, // base 0.2550
    ],
  },
  SUI2: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1303,
        enabled: true,
        minSampleN: 84,
      }, // base 0.1533
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1458,
        enabled: true,
        minSampleN: 94,
      }, // base 0.1715
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0527,
        enabled: true,
        minSampleN: 34,
      }, // base 0.0620
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1613,
        enabled: true,
        minSampleN: 104,
      }, // base 0.1898
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1768,
        enabled: true,
        minSampleN: 114,
      }, // base 0.2080
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.183,
        enabled: true,
        minSampleN: 118,
      }, // base 0.2153
    ],
  },
  SVN1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.135,
        enabled: true,
        minSampleN: 85,
      }, // base 0.1589
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1446,
        enabled: true,
        minSampleN: 91,
      }, // base 0.1701
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0493,
        enabled: true,
        minSampleN: 31,
      }, // base 0.0579
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1541,
        enabled: true,
        minSampleN: 97,
      }, // base 0.1813
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1875,
        enabled: true,
        minSampleN: 118,
      }, // base 0.2206
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1795,
        enabled: true,
        minSampleN: 113,
      }, // base 0.2112
    ],
  },
  SWE1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1502,
        enabled: true,
        minSampleN: 144,
      }, // base 0.1767
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.146,
        enabled: true,
        minSampleN: 140,
      }, // base 0.1718
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.049,
        enabled: true,
        minSampleN: 47,
      }, // base 0.0577
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1335,
        enabled: true,
        minSampleN: 128,
      }, // base 0.1571
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2034,
        enabled: true,
        minSampleN: 195,
      }, // base 0.2393
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1679,
        enabled: true,
        minSampleN: 161,
      }, // base 0.1975
    ],
  },
  SWE2: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1278,
        enabled: true,
        minSampleN: 124,
      }, // base 0.1503
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1185,
        enabled: true,
        minSampleN: 115,
      }, // base 0.1394
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0639,
        enabled: true,
        minSampleN: 62,
      }, // base 0.0752
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1628,
        enabled: true,
        minSampleN: 158,
      }, // base 0.1915
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1968,
        enabled: true,
        minSampleN: 191,
      }, // base 0.2315
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1803,
        enabled: true,
        minSampleN: 175,
      }, // base 0.2121
    ],
  },
  TUR1: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.119,
        enabled: true,
        minSampleN: 144,
      }, // base 0.1399
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1214,
        enabled: true,
        minSampleN: 147,
      }, // base 0.1429
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0669,
        enabled: true,
        minSampleN: 81,
      }, // base 0.0787
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1561,
        enabled: true,
        minSampleN: 189,
      }, // base 0.1837
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1925,
        enabled: true,
        minSampleN: 233,
      }, // base 0.2264
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1941,
        enabled: true,
        minSampleN: 235,
      }, // base 0.2284
    ],
  },
  TUR2: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1543,
        enabled: true,
        minSampleN: 198,
      }, // base 0.1815
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1075,
        enabled: true,
        minSampleN: 138,
      }, // base 0.1265
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0686,
        enabled: true,
        minSampleN: 88,
      }, // base 0.0807
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.141,
        enabled: true,
        minSampleN: 181,
      }, // base 0.1659
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2353,
        enabled: true,
        minSampleN: 302,
      }, // base 0.2768
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1434,
        enabled: true,
        minSampleN: 184,
      }, // base 0.1687
    ],
  },
  UCL: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.129,
        enabled: true,
        minSampleN: 129,
      }, // base 0.1518
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.142,
        enabled: true,
        minSampleN: 142,
      }, // base 0.1671
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.045,
        enabled: true,
        minSampleN: 45,
      }, // base 0.0529
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.121,
        enabled: true,
        minSampleN: 121,
      }, // base 0.1424
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.226,
        enabled: true,
        minSampleN: 226,
      }, // base 0.2659
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.187,
        enabled: true,
        minSampleN: 187,
      }, // base 0.2200
    ],
  },
  UECL: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1353,
        enabled: true,
        minSampleN: 230,
      }, // base 0.1592
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1224,
        enabled: true,
        minSampleN: 208,
      }, // base 0.1439
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0506,
        enabled: true,
        minSampleN: 86,
      }, // base 0.0595
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1282,
        enabled: true,
        minSampleN: 218,
      }, // base 0.1509
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2365,
        enabled: true,
        minSampleN: 402,
      }, // base 0.2782
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1771,
        enabled: true,
        minSampleN: 301,
      }, // base 0.2083
    ],
  },
  UEL: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1258,
        enabled: true,
        minSampleN: 114,
      }, // base 0.1481
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1258,
        enabled: true,
        minSampleN: 114,
      }, // base 0.1481
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.053,
        enabled: true,
        minSampleN: 48,
      }, // base 0.0623
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1236,
        enabled: true,
        minSampleN: 112,
      }, // base 0.1455
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2241,
        enabled: true,
        minSampleN: 203,
      }, // base 0.2636
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1976,
        enabled: true,
        minSampleN: 179,
      }, // base 0.2325
    ],
  },
  UNL: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1402,
        enabled: true,
        minSampleN: 31,
      }, // base 0.1649
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2487,
        enabled: true,
        minSampleN: 55,
      }, // base 0.2926
    ],
  },
  USA2: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1346,
        enabled: true,
        minSampleN: 229,
      }, // base 0.1584
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.1217,
        enabled: true,
        minSampleN: 207,
      }, // base 0.1432
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0694,
        enabled: true,
        minSampleN: 118,
      }, // base 0.0816
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1522,
        enabled: true,
        minSampleN: 259,
      }, // base 0.1791
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2022,
        enabled: true,
        minSampleN: 344,
      }, // base 0.2379
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1699,
        enabled: true,
        minSampleN: 289,
      }, // base 0.1999
    ],
  },
  WC: {
    picks: [
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.1973,
        enabled: true,
        minSampleN: 39,
      }, // base 0.2321
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1872,
        enabled: true,
        minSampleN: 37,
      }, // base 0.2202
    ],
  },
  WCQAF: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1999,
        enabled: true,
        minSampleN: 99,
      }, // base 0.2352
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.0747,
        enabled: true,
        minSampleN: 37,
      }, // base 0.0879
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0747,
        enabled: true,
        minSampleN: 37,
      }, // base 0.0879
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1312,
        enabled: true,
        minSampleN: 65,
      }, // base 0.1544
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2483,
        enabled: true,
        minSampleN: 123,
      }, // base 0.2922
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1211,
        enabled: true,
        minSampleN: 60,
      }, // base 0.1425
    ],
  },
  WCQAS: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.205,
        enabled: true,
        minSampleN: 110,
      }, // base 0.2412
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.0802,
        enabled: true,
        minSampleN: 43,
      }, // base 0.0943
      {
        side: "DRAW",
        outcome: "NO",
        threshold: 0.0708,
        enabled: true,
        minSampleN: 38,
      }, // base 0.0833
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1063,
        enabled: true,
        minSampleN: 57,
      }, // base 0.1250
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2703,
        enabled: true,
        minSampleN: 145,
      }, // base 0.3180
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1174,
        enabled: true,
        minSampleN: 63,
      }, // base 0.1382
    ],
  },
  WCQCA: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.1716,
        enabled: true,
        minSampleN: 44,
      }, // base 0.2018
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.117,
        enabled: true,
        minSampleN: 30,
      }, // base 0.1376
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.3119,
        enabled: true,
        minSampleN: 80,
      }, // base 0.3670
    ],
  },
  WCQE: {
    picks: [
      {
        side: "AWAY",
        outcome: "NO",
        threshold: 0.2116,
        enabled: true,
        minSampleN: 115,
      }, // base 0.2489
      {
        side: "AWAY",
        outcome: "YES",
        threshold: 0.0957,
        enabled: true,
        minSampleN: 52,
      }, // base 0.1126
      {
        side: "DRAW",
        outcome: "YES",
        threshold: 0.1233,
        enabled: true,
        minSampleN: 67,
      }, // base 0.1450
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.2392,
        enabled: true,
        minSampleN: 130,
      }, // base 0.2814
      {
        side: "HOME",
        outcome: "YES",
        threshold: 0.1417,
        enabled: true,
        minSampleN: 77,
      }, // base 0.1667
    ],
  },
  WCQSA: {
    picks: [
      {
        side: "HOME",
        outcome: "NO",
        threshold: 0.3134,
        enabled: true,
        minSampleN: 66,
      }, // base 0.3687
    ],
  },
};

// Resolve the enabled RESULT_BTTS pick configs for a league (empty when none).
export function getResultBttsPickConfigs(
  competitionCode: string | null | undefined,
): readonly ResultBttsPickConfig[] {
  if (competitionCode == null) return [];
  const leagueConfig = RESULT_BTTS_CONFIG[competitionCode];
  if (!leagueConfig) return [];
  return leagueConfig.picks.filter((p) => p.enabled);
}
