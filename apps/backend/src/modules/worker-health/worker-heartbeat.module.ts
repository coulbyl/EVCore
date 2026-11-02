import { Module } from '@nestjs/common';
import { WorkerHeartbeatScheduler } from './worker-heartbeat.scheduler';

/** The worker side: writes the heartbeat (worker.module.ts only). */
@Module({
  providers: [WorkerHeartbeatScheduler],
})
export class WorkerHeartbeatModule {}
