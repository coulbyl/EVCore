import Decimal from "decimal.js";
import type { ChannelStrategyLeagueConfig } from "./channel-strategy-config.types";

// FIRST_HALF_WINNER's own margin constant (2026-08-16) — same conviction-gap
// reasoning as DOMINANT_MIN_MARGIN (prevents "barely-argmax" picks when all
// three HT outcomes cluster close together), kept separate rather than
// reused: it's a different market with its own probability distribution
// (DRAW is the modal HT outcome in most calibrated leagues, unlike
// full-time), independently tunable once real data accumulates.
export const FIRST_HALF_WINNER_MIN_MARGIN = new Decimal("0.05");

// FIRST_HALF (channel key for Market.FIRST_HALF_WINNER — matches
// STRATEGY_CHANNEL.FIRST_HALF's key) — argmax(HOME/DRAW/AWAY) on the
// half-time result, same shape as DOMINANT but a genuinely different
// signal: DRAW is the modal HT outcome in all 7 leagues below (e.g. SA
// home 0.302/draw 0.428/away 0.270), the opposite of full-time where
// DOMINANT rarely picks DRAW. Gated separately in the strategy by
// SelectionConfig.htftCalibrated — only the leagues below (the 7 in
// ev.constants.ts HTFT_CALIBRATED_LEAGUES) have real HT decomposition
// history, so this table intentionally has far fewer entries than
// CLEAN_SHEET/WIN_TO_NIL's 60+. threshold = that league's own HT argmax
// rate − 0.05, same derivation rule as CLEAN_SHEET/WIN_TO_NIL. Derived
// 2026-08-16 from settled HT scores (docker exec evcore-postgres psql).
export const FIRST_HALF_CONFIG: Record<string, ChannelStrategyLeagueConfig> = {
  BL1: { enabled: true, threshold: 0.31, minSampleN: 924 }, // HT home 0.3474, draw 0.3593, away 0.2933
  CH: { enabled: true, threshold: 0.37, minSampleN: 1679 }, // HT home 0.3377, draw 0.4193, away 0.2430
  EL1: { enabled: true, threshold: 0.36, minSampleN: 1683 }, // HT home 0.3333, draw 0.4100, away 0.2567
  L1: { enabled: true, threshold: 0.35, minSampleN: 925 }, // HT home 0.3330, draw 0.4000, away 0.2670
  LL: { enabled: true, threshold: 0.38, minSampleN: 1140 }, // HT home 0.3465, draw 0.4289, away 0.2246
  PL: { enabled: true, threshold: 0.33, minSampleN: 1520 }, // HT home 0.3638, draw 0.3803, away 0.2559
  SA: { enabled: true, threshold: 0.38, minSampleN: 1139 }, // HT home 0.3020, draw 0.4284, away 0.2695
};

export const FIRST_HALF_DEFAULT: ChannelStrategyLeagueConfig = {
  enabled: false,
  threshold: 0.99,
  minSampleN: 20,
};
