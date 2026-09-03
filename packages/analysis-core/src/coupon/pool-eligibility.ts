import {
  FILTER_STRATEGY_CHANNELS,
  META_STRATEGY_CHANNELS,
  STRATEGY_CHANNEL,
  type StrategyChannel,
} from "../types/strategy-channel";

// Moved from apps/backend/src/modules/coupon/coupon.constants.ts 2026-09-03 —
// pure channel-eligibility data needed by apps/vantage-worker's own coupon
// pool query too (see docs/vantage-centric-redesign-2026-09-01.md §9bis).

// Channels allowed to contribute a leg to the real coupon pool.
//
// Every channel that produces its OWN pick is admitted. What is excluded is
// only what does not produce an original pick:
//
//   - META (CONSENSUS, CONTRARIAN, AVOID — `META_STRATEGY_CHANNELS`).
//     CONSENSUS re-published a pick that already came from a Phase-1 channel
//     — verified 2026-08-22, all 765 of its settled selections matched
//     another channel's on the same model run, same market, same pick, same
//     probability to 4 decimals — and it no longer emits selections at all
//     (consensus.strategy.ts). AVOID is a rejection signal. CONTRARIAN is
//     unimplemented.
//   - FILTERS (VALUE, SAFE — `FILTER_STRATEGY_CHANNELS`). Phase-2 channels
//     that re-select among Phase-1 picks: 89.5% and 93.3% of their
//     selections respectively duplicate a Phase-1 pick exactly. Admitting
//     them would put the same underlying bet in the pool twice under two
//     labels, and the label carries the worse calibration of the two.
//
// Why NOT a quality bar. An earlier version of this list gated admission on
// each channel's measured calibration ratio (>= 0.90), which excluded 11 of
// 19 channels. That was the wrong instrument. Selecting channels by their
// past ratio is itself a selection on a noisy statistic, and it froze the
// pool against a snapshot that concept drift makes stale within weeks. The
// bias each channel carries is now CORRECTED at scoring time instead
// (calibrateLegProbability, channel-reliability.ts) — a channel announcing
// 0.70 that realises 0.51 enters the pool at ~0.51 and loses on merit,
// rather than being kept out by a list somebody has to maintain.
export const POOL_EXCLUDED_CHANNELS: ReadonlySet<StrategyChannel> = new Set([
  ...META_STRATEGY_CHANNELS,
  ...FILTER_STRATEGY_CHANNELS,
]);

export const POOL_ELIGIBLE_CHANNELS: readonly StrategyChannel[] = (
  Object.values(STRATEGY_CHANNEL) as StrategyChannel[]
).filter((channel) => !POOL_EXCLUDED_CHANNELS.has(channel));

// DRAW staking, per-league (added 2026-08-09) — DRAW previously staked
// globally off a single low CANAL_BASE_WEIGHT.DRAW=0.2 prior, which hid a
// per-league ROI spread from +41% to -45%. db:backtest:channel-league-
// whitelist (60/40 split by day, confirmed only if both halves clear n>=20
// AND stay positive) confirms exactly these 4: I2 +6.7%, POR +10.5%,
// BL1 +15.8%, CSL +26.5%/+0.1% (added 2026-08-15, train n=82/valid n=21 — a
// train-period sample finally accumulated). Several other leagues still look
// promising in the aggregate (FRI, KOR1/2, BRA2, WC, CHN2) but have no
// train-period sample yet (too little settled history) — revisit once they
// do, don't add them off the aggregate alone.
export const DRAW_STAKED_LEAGUES = ["I2", "POR", "BL1", "CSL"] as const;
