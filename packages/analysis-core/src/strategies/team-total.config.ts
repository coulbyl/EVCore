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
        // Tuning 2026-07-28 (backtest-tuning sweep): 0.43 -> 0.50 (ROI
        // +11.5%, n=21, hit 52%).
        threshold: 0.5,
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
        // Tuning 2026-07-28 (backtest-tuning sweep): 0.73 -> 0.45 (ROI
        // +12.4%, n=33, hit 85% — high hit rate at a low threshold, see
        // GOALS_PROMOTION_RULE comment on trivial-hit-rate lines; ROI-
        // driven promotion still applies).
        threshold: 0.45,
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
        // Tuning 2026-07-28 (backtest-tuning sweep): 0.63 -> 0.65 (ROI
        // +16.7%, n=23, hit 83%).
        threshold: 0.65,
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
