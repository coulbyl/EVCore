import { Module } from '@nestjs/common';
import { ConsoleModule } from './console.module';
import {
  ConsoleWatchScheduler,
  ConsoleWatchWorker,
} from './console-watch.scheduler';

/** The ten-minute check of the lights, in the worker process only. */
@Module({
  imports: [ConsoleModule],
  providers: [ConsoleWatchScheduler, ConsoleWatchWorker],
})
export class ConsoleWorkerModule {}
