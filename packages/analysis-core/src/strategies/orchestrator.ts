import {
  META_STRATEGY_CHANNELS,
  STRATEGY_CHANNEL,
  type StrategyChannel,
} from '../types';
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
} from './types';

export { STRATEGY_CHANNEL };

export class ChannelStrategyOrchestrator {
  constructor(private readonly strategies: readonly ChannelStrategy[]) {}

  evaluate(context: StrategyContext): StrategyDecision[] {
    const phase1Decisions = new Map<StrategyChannel, StrategyDecision>();
    const results: StrategyDecision[] = [];

    // Phase 1 — primary strategies (EV, SAFE, DOMINANT, BTTS, DRAW, …)
    for (const strategy of this.strategies) {
      if (META_STRATEGY_CHANNELS.has(strategy.channel)) continue;
      if (!this.isApplicable(strategy, context)) continue;

      const decision = strategy.evaluate({
        ...context,
        previousDecisions: phase1Decisions,
      });
      this.assertAllowedMarkets(strategy, decision);
      phase1Decisions.set(strategy.channel, decision);
      results.push(decision);
    }

    // Phase 2 — meta-strategies (CONSENSUS, CONTRARIAN, AVOID) — post-v1
    for (const strategy of this.strategies) {
      if (!META_STRATEGY_CHANNELS.has(strategy.channel)) continue;
      if (!this.isApplicable(strategy, context)) continue;

      const decision = strategy.evaluate({
        ...context,
        previousDecisions: phase1Decisions,
      });
      this.assertAllowedMarkets(strategy, decision);
      results.push(decision);
    }

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
            `Allowed: ${strategy.allowedMarkets.join(', ')}`,
        );
      }
    }
  }
}
