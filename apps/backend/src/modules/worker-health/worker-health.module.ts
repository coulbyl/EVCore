import { Module } from '@nestjs/common';
import { WorkerHealthController } from './worker-health.controller';
import { WorkerHealthService } from './worker-health.service';

/** The API side: reads the worker's heartbeat. */
@Module({
  controllers: [WorkerHealthController],
  providers: [WorkerHealthService],
})
export class WorkerHealthModule {}
