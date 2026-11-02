import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullRootModule } from './common/bullmq/bull-root.module';
import { ObservabilityModule } from './common/observability/observability.module';
import { RedisModule } from './common/redis/redis.module';
import { validateEnv } from './config/env.schema';
import { AdminJournalModule } from './modules/admin-journal/admin-journal.module';
import { AppSettingModule } from './modules/app-setting/app-setting.module';
import { SchedulingSwitchModule } from './modules/app-setting/scheduling-switch.module';
import { ConsoleWorkerModule } from './modules/console/console-worker.module';
import { EtlWorkerModule } from './modules/etl/etl-worker.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { PushWorkerModule } from './modules/push/push-worker.module';
import { SlipDigestModule } from './modules/slip-digest/slip-digest.module';
import { WorkerHeartbeatModule } from './modules/worker-health/worker-heartbeat.module';
import { PrismaModule } from './prisma.module';

/**
 * The worker process (main.worker.ts): every queue consumer and recurring
 * schedule, no HTTP server. Same domain modules as the API, so a rule
 * exists once; the API itself only puts jobs on the queues. A new consumer
 * or schedule goes in a `<feature>-worker.module` imported here, never in
 * AppModule (checked by process-separation.spec.ts).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // The global modules the API loads, so a shared service resolves the same.
    AdminJournalModule,
    AppSettingModule,
    IntegrationsModule,
    BullRootModule,
    RedisModule,
    PrismaModule,
    EtlWorkerModule,
    ConsoleWorkerModule,
    SlipDigestModule,
    PushWorkerModule,
    SchedulingSwitchModule,
    WorkerHeartbeatModule,
    ObservabilityModule,
  ],
})
export class WorkerModule {}
