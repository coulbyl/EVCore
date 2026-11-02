import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { GLOBAL_RATE_LIMIT } from '@config/rate-limit.constants';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { EtlModule } from './modules/etl/etl.module';
import { BettingEngineModule } from './modules/betting-engine/betting-engine.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AdjustmentModule } from './modules/adjustment/adjustment.module';
import { AdminJournalModule } from './modules/admin-journal/admin-journal.module';
import { ConsoleModule } from './modules/console/console.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { SupportModule } from './modules/support/support.module';
import { PushModule } from './modules/push/push.module';
import { ActivityModule } from './modules/activity/activity.module';
import { CouponModule } from './modules/coupon/coupon.module';
import { ScreensModule } from './modules/screens/screens.module';
import { VerifiedTicketModule } from './modules/verified-ticket/verified-ticket.module';
import { AnalysisSheetModule } from './modules/analysis-sheet/analysis-sheet.module';
import { BullRootModule } from './common/bullmq/bull-root.module';
import { ObservabilityModule } from './common/observability/observability.module';
import { RedisModule } from './common/redis/redis.module';
import { validateEnv } from './config/env.schema';
import { AppSettingModule } from './modules/app-setting/app-setting.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { WorkerHealthModule } from './modules/worker-health/worker-health.module';

/**
 * The API process (main.ts): HTTP routes and the support chat. It puts jobs
 * on the queues; their consumers and the recurring schedules run in the
 * worker process (worker.module.ts).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    AppSettingModule,
    IntegrationsModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: GLOBAL_RATE_LIMIT.ttlMs,
        limit: GLOBAL_RATE_LIMIT.limit,
      },
    ]),
    BullRootModule,
    RedisModule,
    PrismaModule,
    EtlModule,
    BettingEngineModule,
    NotificationModule,
    AdjustmentModule,
    AuthModule,
    AdminJournalModule,
    ConsoleModule,
    DashboardModule,
    AdminUsersModule,
    AnnouncementsModule,
    SupportModule,
    PushModule,
    ActivityModule,
    CouponModule,
    ScreensModule,
    VerifiedTicketModule,
    AnalysisSheetModule,
    WorkerHealthModule,
    ObservabilityModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
