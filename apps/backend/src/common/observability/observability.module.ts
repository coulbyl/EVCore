import { Module } from '@nestjs/common';
import { EventLoopMonitor } from './event-loop-monitor';

/** Process-level measures, loaded by both the API and the worker. */
@Module({
  providers: [EventLoopMonitor],
})
export class ObservabilityModule {}
