import type { StrategyChannel } from '@evcore/db';

/** One EV-bin row inside a channel's rolling ROI breakdown. */
export type CouponRoiBinRow = {
  /** Human label, e.g. `8–15%` or `n/a` (selections without an EV, e.g. DRAW). */
  label: string;
  /** Bin bounds in EV units (`null` for the no-EV bucket). */
  from: number | null;
  to: number | null;
  total: number;
  won: number;
  hitRate: number;
  /** Flat-stake ROI over the bin (won → odds−1, lost → −1). */
  roi: number;
  /**
   * Promotion hint: ROI > 0 with a large-enough sample. A tool signal only — the
   * backend never auto-stakes a channel/bin off this flag.
   */
  promote: boolean;
};

/** Rolling ROI for one channel: an overall line + the EV-bin breakdown. */
export type CouponRoiChannelRow = {
  channel: StrategyChannel;
  total: number;
  won: number;
  hitRate: number;
  roi: number;
  bins: CouponRoiBinRow[];
};

export type CouponRoiResponse = {
  from: string;
  to: string;
  /** Minimum settled sample for a `promote` hint. */
  minPromotionSample: number;
  channels: CouponRoiChannelRow[];
};
