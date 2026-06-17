import type { ChannelStrategy } from '../channel-strategy.types';
import { ChannelStrategyOrchestrator } from './channel-strategy.orchestrator';
import { EvStrategy } from './ev.strategy';
import { SafeStrategy } from './safe.strategy';
import { DominantStrategy } from './dominant.strategy';
import { BttsStrategy } from './btts.strategy';
import { DrawStrategy } from './draw.strategy';

// v1 registry — order matters: EV runs before SAFE (SAFE excludes the EV pick).
// Primary strategies only; meta-strategies (CONSENSUS, CONTRARIAN, AVOID) are
// added in a later phase and run in the orchestrator's phase 2.
export const V1_STRATEGIES: readonly ChannelStrategy[] = [
  new EvStrategy(),
  new SafeStrategy(),
  new DominantStrategy(),
  new BttsStrategy(),
  new DrawStrategy(),
];

export function createChannelStrategyOrchestrator(): ChannelStrategyOrchestrator {
  return new ChannelStrategyOrchestrator(V1_STRATEGIES);
}
