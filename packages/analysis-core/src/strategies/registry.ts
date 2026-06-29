import type { ChannelStrategy } from "./types";
import { ChannelStrategyOrchestrator } from "./orchestrator";
import { ValueStrategy } from "./value.strategy";
import { SafeStrategy } from "./safe.strategy";
import { DominantStrategy } from "./dominant.strategy";
import { BttsStrategy } from "./btts.strategy";
import { DrawStrategy } from "./draw.strategy";
import { GoalsStrategy } from "./goals.strategy";
import { ConsensusStrategy } from "./consensus.strategy";
import { AvoidStrategy } from "./avoid.strategy";

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
