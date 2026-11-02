import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

/**
 * The BullMQ connection, the same for both processes: the API puts jobs on
 * the queues, the worker (main.worker.ts) consumes them.
 */
export const BullRootModule = BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    connection: {
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
    },
  }),
});
