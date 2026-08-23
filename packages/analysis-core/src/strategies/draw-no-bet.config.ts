import type { ChannelStrategyLeagueConfig } from "./channel-strategy-config.types";

// ─────────────────────────────────────────────
// DRAW_NO_BET — derived two-way market (draw refunded), no line dimension.
// No walk-forward shrinkage exists yet — same situation as RESULT_BTTS,
// derived directly from settled fixtures (docker exec evcore-postgres psql):
// among decisive (non-draw) FINISHED fixtures per league, home win rate =
// count(home wins) / count(decisive fixtures). Universal home advantage
// across every league in this dataset (min 0.51, never below) means AWAY
// never clears an informative margin — this reuses the SAME
// evaluate-both-sides-take-argmax shape as CleanSheetStrategy/decideCleanSheet
// (not a per-league pre-selected side like TEAM_TOTAL/OVER_UNDER_HT) so an
// AWAY-favoring league would still be picked up correctly if one existed.
// Kept as its own config map rather than folded into CHANNEL_STRATEGY_CONFIG:
// that map's other entries (DOMINANT/DRAW/BTTS/CLEAN_SHEET/WIN_EITHER_HALF)
// are real ROI-backtested thresholds, this is a pure OBSERVATION base-rate
// launch (same distinction TEAM_TOTAL/RESULT_BTTS draw from that map).
// Rule (same as TEAM_TOTAL's OVER/UNDER split): only leagues with a rate
// ≥ 0.55 are included (0.45–0.55 dropped as uninformative — 3 of 67 leagues:
// AUS1, EST1, KOR2), threshold = rate − 0.05 (flat margin: dnbHome/dnbAway
// are genuine marginals, same magnitude family as TEAM_TOTAL, not joint like
// RESULT_TOTAL_GOALS/RESULT_BTTS).
// ─────────────────────────────────────────────

export const DRAW_NO_BET_DEFAULT: ChannelStrategyLeagueConfig = {
  enabled: false,
  threshold: 0.99,
  minSampleN: 50,
};

export const DRAW_NO_BET_CONFIG: Record<string, ChannelStrategyLeagueConfig> = {
  ARG1: { enabled: true, threshold: 0.5827, minSampleN: 1081 }, // home win rate (decisive) 0.6327
  ARG2: { enabled: true, threshold: 0.6284, minSampleN: 1673 }, // home win rate (decisive) 0.6784
  AUT1: { enabled: true, threshold: 0.5142, minSampleN: 436 }, // home win rate (decisive) 0.5642
  BEL1: { enabled: true, threshold: 0.5366, minSampleN: 704 }, // home win rate (decisive) 0.5866
  BL1: { enabled: true, threshold: 0.5125, minSampleN: 688 }, // home win rate (decisive) 0.5625
  BRA1: { enabled: true, threshold: 0.6015, minSampleN: 881 }, // home win rate (decisive) 0.6515
  BRA2: { enabled: true, threshold: 0.6108, minSampleN: 967 }, // home win rate (decisive) 0.6608
  CH: { enabled: true, threshold: 0.5434, minSampleN: 1242 }, // home win rate (decisive) 0.5934
  CHI1: { enabled: true, threshold: 0.5431, minSampleN: 671 }, // home win rate (decisive) 0.5931
  CHI2: { enabled: true, threshold: 0.514, minSampleN: 461 }, // home win rate (decisive) 0.5640
  CHN2: { enabled: true, threshold: 0.5612, minSampleN: 607 }, // home win rate (decisive) 0.6112
  CSL: { enabled: true, threshold: 0.5658, minSampleN: 596 }, // home win rate (decisive) 0.6158
  CZE1: { enabled: true, threshold: 0.5381, minSampleN: 641 }, // home win rate (decisive) 0.5881
  D2: { enabled: true, threshold: 0.5377, minSampleN: 701 }, // home win rate (decisive) 0.5877
  D3: { enabled: true, threshold: 0.5576, minSampleN: 869 }, // home win rate (decisive) 0.6076
  DEN1: { enabled: true, threshold: 0.5234, minSampleN: 443 }, // home win rate (decisive) 0.5734
  EL1: { enabled: true, threshold: 0.53, minSampleN: 1269 }, // home win rate (decisive) 0.5800
  EL2: { enabled: true, threshold: 0.5279, minSampleN: 1251 }, // home win rate (decisive) 0.5779
  ERD: { enabled: true, threshold: 0.5414, minSampleN: 722 }, // home win rate (decisive) 0.5914
  F2: { enabled: true, threshold: 0.5339, minSampleN: 733 }, // home win rate (decisive) 0.5839
  FIN1: { enabled: true, threshold: 0.5281, minSampleN: 448 }, // home win rate (decisive) 0.5781
  FIN2: { enabled: true, threshold: 0.5152, minSampleN: 276 }, // home win rate (decisive) 0.5652
  FRI: { enabled: true, threshold: 0.595, minSampleN: 262 }, // home win rate (decisive) 0.6450
  GRE1: { enabled: true, threshold: 0.5187, minSampleN: 531 }, // home win rate (decisive) 0.5687
  I2: { enabled: true, threshold: 0.552, minSampleN: 794 }, // home win rate (decisive) 0.6020
  IRL1: { enabled: true, threshold: 0.5458, minSampleN: 480 }, // home win rate (decisive) 0.5958
  ISL1: { enabled: true, threshold: 0.5815, minSampleN: 426 }, // home win rate (decisive) 0.6315
  J1: { enabled: true, threshold: 0.5087, minSampleN: 945 }, // home win rate (decisive) 0.5587
  KOR1: { enabled: true, threshold: 0.5201, minSampleN: 535 }, // home win rate (decisive) 0.5701
  KSA1: { enabled: true, threshold: 0.5068, minSampleN: 722 }, // home win rate (decisive) 0.5568
  L1: { enabled: true, threshold: 0.5267, minSampleN: 704 }, // home win rate (decisive) 0.5767
  LAT1: { enabled: true, threshold: 0.5208, minSampleN: 473 }, // home win rate (decisive) 0.5708
  LL: { enabled: true, threshold: 0.5692, minSampleN: 843 }, // home win rate (decisive) 0.6192
  MLS: { enabled: true, threshold: 0.5484, minSampleN: 884 }, // home win rate (decisive) 0.5984
  MX1: { enabled: true, threshold: 0.5756, minSampleN: 780 }, // home win rate (decisive) 0.6256
  NOR1: { enabled: true, threshold: 0.5453, minSampleN: 645 }, // home win rate (decisive) 0.5953
  NOR2: { enabled: true, threshold: 0.5246, minSampleN: 630 }, // home win rate (decisive) 0.5746
  PL: { enabled: true, threshold: 0.5358, minSampleN: 1154 }, // home win rate (decisive) 0.5858
  POL1: { enabled: true, threshold: 0.5667, minSampleN: 681 }, // home win rate (decisive) 0.6167
  POL2: { enabled: true, threshold: 0.5029, minSampleN: 700 }, // home win rate (decisive) 0.5529
  POR: { enabled: true, threshold: 0.5268, minSampleN: 690 }, // home win rate (decisive) 0.5768
  RUS1: { enabled: true, threshold: 0.5598, minSampleN: 551 }, // home win rate (decisive) 0.6098
  SA: { enabled: true, threshold: 0.5079, minSampleN: 821 }, // home win rate (decisive) 0.5579
  SCO1: { enabled: true, threshold: 0.5459, minSampleN: 537 }, // home win rate (decisive) 0.5959
  SP2: { enabled: true, threshold: 0.5838, minSampleN: 1013 }, // home win rate (decisive) 0.6338
  SRB1: { enabled: true, threshold: 0.5306, minSampleN: 689 }, // home win rate (decisive) 0.5806
  SUI1: { enabled: true, threshold: 0.5613, minSampleN: 530 }, // home win rate (decisive) 0.6113
  SUI2: { enabled: true, threshold: 0.5159, minSampleN: 410 }, // home win rate (decisive) 0.5659
  SVN1: { enabled: true, threshold: 0.5176, minSampleN: 407 }, // home win rate (decisive) 0.5676
  SWE1: { enabled: true, threshold: 0.5063, minSampleN: 640 }, // home win rate (decisive) 0.5563
  SWE2: { enabled: true, threshold: 0.555, minSampleN: 605 }, // home win rate (decisive) 0.6050
  TUR1: { enabled: true, threshold: 0.5666, minSampleN: 759 }, // home win rate (decisive) 0.6166
  TUR2: { enabled: true, threshold: 0.5412, minSampleN: 822 }, // home win rate (decisive) 0.5912
  UCL: { enabled: true, threshold: 0.5538, minSampleN: 684 }, // home win rate (decisive) 0.6038
  UECL: { enabled: true, threshold: 0.5661, minSampleN: 1141 }, // home win rate (decisive) 0.6161
  UEL: { enabled: true, threshold: 0.5762, minSampleN: 610 }, // home win rate (decisive) 0.6262
  UNL: { enabled: true, threshold: 0.5333, minSampleN: 144 }, // home win rate (decisive) 0.5833
  USA2: { enabled: true, threshold: 0.5421, minSampleN: 1069 }, // home win rate (decisive) 0.5921
  WC: { enabled: true, threshold: 0.558, minSampleN: 125 }, // home win rate (decisive) 0.6080
  WCQAF: { enabled: true, threshold: 0.5237, minSampleN: 319 }, // home win rate (decisive) 0.5737
  WCQAS: { enabled: true, threshold: 0.5262, minSampleN: 361 }, // home win rate (decisive) 0.5762
  WCQCA: { enabled: true, threshold: 0.5772, minSampleN: 169 }, // home win rate (decisive) 0.6272
  WCQE: { enabled: true, threshold: 0.5035, minSampleN: 374 }, // home win rate (decisive) 0.5535
  WCQSA: { enabled: true, threshold: 0.6577, minSampleN: 130 }, // home win rate (decisive) 0.7077
};

// Resolve the DRAW_NO_BET config for a league (disabled default when not listed).
export function getDrawNoBetConfig(
  competitionCode: string | null | undefined,
): ChannelStrategyLeagueConfig {
  if (competitionCode == null) return DRAW_NO_BET_DEFAULT;
  return DRAW_NO_BET_CONFIG[competitionCode] ?? DRAW_NO_BET_DEFAULT;
}
