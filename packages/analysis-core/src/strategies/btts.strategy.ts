import Decimal from "decimal.js";
import { Market } from "../types";
import { CHANNEL_DECISION_STATUS, STRATEGY_CHANNEL } from "../types";
import { priceForSelection } from "../selection";
import { getBttsNoConfig, getChannelStrategyConfig } from "./config";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
} from "./types";

type BttsCandidate = { pick: "YES" | "NO"; probability: Decimal };

export class BttsStrategy implements ChannelStrategy {
  readonly channel = STRATEGY_CHANNEL.BTTS;
  readonly allowedMarkets: readonly Market[] = [Market.BTTS];

  evaluate(context: StrategyContext): StrategyDecision {
    const ch = this.channel;
    // YES and NO are both calibrated per league but separately (different scales);
    // NO is observation only — see BTTS_NO_CONFIG. Both live on the BTTS market.
    const yesConfig = getChannelStrategyConfig("BTTS", context.competitionCode);
    const noConfig = getBttsNoConfig(context.competitionCode);

    if (!yesConfig.enabled && !noConfig.enabled) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.DISABLED,
        selections: [],
      };
    }

    const { bttsYes, bttsNo } = context.probabilities;
    const candidates: BttsCandidate[] = [];
    if (yesConfig.enabled && !bttsYes.lessThan(yesConfig.threshold)) {
      candidates.push({ pick: "YES", probability: bttsYes });
    }
    if (noConfig.enabled && !bttsNo.lessThan(noConfig.threshold)) {
      candidates.push({ pick: "NO", probability: bttsNo });
    }

    if (candidates.length === 0) {
      return {
        channel: ch,
        status: CHANNEL_DECISION_STATUS.REJECTED,
        reasonCode: "below_threshold",
        reasonDetails: {
          bttsYes: bttsYes.toNumber(),
          yesThreshold: yesConfig.enabled ? yesConfig.threshold : null,
          bttsNo: bttsNo.toNumber(),
          noThreshold: noConfig.enabled ? noConfig.threshold : null,
        },
        selections: [],
      };
    }

    // YES and NO are mutually exclusive; if both clear their thresholds pick the
    // more confident side (higher model probability).
    const best = candidates.reduce((a, b) =>
      b.probability.greaterThan(a.probability) ? b : a,
    );

    return {
      channel: ch,
      status: CHANNEL_DECISION_STATUS.SELECTED,
      selections: [
        {
          market: Market.BTTS,
          pick: best.pick,
          probability: best.probability,
          ...priceForSelection({
            odds: context.odds,
            market: Market.BTTS,
            pick: best.pick,
            probability: best.probability,
          }),
          rank: 1,
        },
      ],
    };
  }
}
