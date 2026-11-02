import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { createLogger } from './utils/logger';

const logger = createLogger('worker');

/**
 * The worker process: BullMQ consumers and recurring schedules, no HTTP
 * server. Started beside the API (`backend-worker` in the compose files)
 * from the same image.
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  // SIGTERM (container stop): the running jobs finish, then BullMQ and
  // Prisma close.
  app.enableShutdownHooks();
  logger.info('Worker running (queue consumers and schedules)');
}
void bootstrap();
