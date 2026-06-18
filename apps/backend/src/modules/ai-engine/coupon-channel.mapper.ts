import { StrategyChannel } from '@evcore/db';

// Coupon generation still consumes the old investment canal labels. Persist the
// coupon leg with the canonical strategy channel used by ChannelDecision.
const COUPON_SOURCE_CHANNEL_TO_STRATEGY: Record<string, StrategyChannel> = {
  EV: StrategyChannel.EV,
  SV: StrategyChannel.SAFE,
  SAFE: StrategyChannel.SAFE,
  BB: StrategyChannel.BTTS,
  BTTS: StrategyChannel.BTTS,
  NUL: StrategyChannel.DRAW,
  DRAW: StrategyChannel.DRAW,
  CONF: StrategyChannel.DOMINANT,
  DOMINANT: StrategyChannel.DOMINANT,
};

export function mapCouponSourceChannel(channel: string): StrategyChannel {
  const normalized = COUPON_SOURCE_CHANNEL_TO_STRATEGY[channel];
  if (normalized === undefined) {
    throw new Error(`Unsupported coupon channel: ${channel}`);
  }
  return normalized;
}
