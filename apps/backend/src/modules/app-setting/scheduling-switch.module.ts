import { Module } from '@nestjs/common';
import { SchedulingSwitchScheduler } from './scheduling-switch.scheduler';

/**
 * « Passes planifiées », applied every minute to the queues: the worker
 * process only, where the queues are consumed. The setting itself is read
 * and written through AppSettingModule, global to both processes.
 */
@Module({
  providers: [SchedulingSwitchScheduler],
})
export class SchedulingSwitchModule {}
