import type { ChannelStrategy } from '../channel-strategy.types';
import { ChannelStrategyOrchestrator } from './channel-strategy.orchestrator';
import { ValueStrategy } from './value.strategy';
import { SafeStrategy } from './safe.strategy';
import { DominantStrategy } from './dominant.strategy';
import { BttsStrategy } from './btts.strategy';
import { DrawStrategy } from './draw.strategy';
import { GoalsStrategy } from './goals.strategy';
import { ConsensusStrategy } from './consensus.strategy';
import { AvoidStrategy } from './avoid.strategy';

// v1 registry — order matters: EV runs before SAFE (SAFE excludes the EV pick).
// Primaries come first; meta-strategies (CONSENSUS, …) are flagged via
// META_STRATEGY_CHANNELS and run in the orchestrator's phase 2 (they read the
// primary decisions), regardless of their position in this list.
export const V1_STRATEGIES: readonly ChannelStrategy[] = [
  new ValueStrategy(),
  new SafeStrategy(),
  new DominantStrategy(),
  new BttsStrategy(),
  new DrawStrategy(),
  new GoalsStrategy(),
  new ConsensusStrategy(),
  new AvoidStrategy(),
];

export function createChannelStrategyOrchestrator(): ChannelStrategyOrchestrator {
  return new ChannelStrategyOrchestrator(V1_STRATEGIES);
}
