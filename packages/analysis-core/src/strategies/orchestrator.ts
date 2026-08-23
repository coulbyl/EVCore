import {
  FILTER_STRATEGY_CHANNELS,
  META_STRATEGY_CHANNELS,
  STRATEGY_CHANNEL,
  type StrategyChannel,
} from "../types";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
} from "./types";

export { STRATEGY_CHANNEL };

// Three phases, one accumulating decisions map — each phase sees every
// decision made by the phases before it (docs/prediction-engine-families.md
// §0, docs/channel-strategy-architecture.md §5):
//
//   Phase 1 — market-specialized channels (DOMINANT, BTTS, DRAW, GOALS, …):
//     each is the specialist for its own market/family, deciding from the
//     shared probabilistic context (evaluatedMarkets).
//   Phase 2 — filters (VALUE, SAFE): select among the picks Phase 1 already
//     vetted, never scan evaluatedMarkets independently.
//   Phase 3 — meta-strategies (CONSENSUS, CONTRARIAN, AVOID): read every
//     decision from Phase 1 and Phase 2.
//
// Before 2026-08-18 this was two phases with a static previousDecisions
// snapshot for Phase 2 (meta only) — VALUE/SAFE lived in Phase 1 as
// independent scanners. The map now accumulates across all three phases so
// meta-strategies still see VALUE/SAFE's decisions (previously guaranteed by
// VALUE/SAFE running in Phase 1; now guaranteed by Phase 2 running before
// Phase 3 instead).
export class ChannelStrategyOrchestrator {
  constructor(private readonly strategies: readonly ChannelStrategy[]) {}

  evaluate(context: StrategyContext): StrategyDecision[] {
    const decisions = new Map<StrategyChannel, StrategyDecision>();
    const results: StrategyDecision[] = [];

    const runPhase = (
      includes: (channel: StrategyChannel) => boolean,
    ): void => {
      for (const strategy of this.strategies) {
        if (!includes(strategy.channel)) continue;
        if (!this.isApplicable(strategy, context)) continue;

        const decision = strategy.evaluate({
          ...context,
          previousDecisions: decisions,
        });
        this.assertAllowedMarkets(strategy, decision);
        decisions.set(strategy.channel, decision);
        results.push(decision);
      }
    };

    runPhase(
      (ch) =>
        !FILTER_STRATEGY_CHANNELS.has(ch) && !META_STRATEGY_CHANNELS.has(ch),
    );
    runPhase((ch) => FILTER_STRATEGY_CHANNELS.has(ch));
    runPhase((ch) => META_STRATEGY_CHANNELS.has(ch));

    return results;
  }

  private isApplicable(
    strategy: ChannelStrategy,
    context: StrategyContext,
  ): boolean {
    if (
      strategy.allowedSports &&
      !strategy.allowedSports.includes(context.sport)
    ) {
      return false;
    }
    return true;
  }

  private assertAllowedMarkets(
    strategy: ChannelStrategy,
    decision: StrategyDecision,
  ): void {
    for (const sel of decision.selections) {
      if (!strategy.allowedMarkets.includes(sel.market)) {
        throw new Error(
          `Strategy ${strategy.channel} returned selection on disallowed market ${sel.market}. ` +
            `Allowed: ${strategy.allowedMarkets.join(", ")}`,
        );
      }
    }
  }
}
