import { Module } from '@nestjs/common';
import { PushModule } from './push.module';
import { PushDeliveryWorker } from './push-delivery.worker';

/** The push delivery queue's consumer, in the worker process only. */
@Module({
  imports: [PushModule],
  providers: [PushDeliveryWorker],
})
export class PushWorkerModule {}
