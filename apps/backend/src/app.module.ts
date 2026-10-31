import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { GLOBAL_RATE_LIMIT } from '@config/rate-limit.constants';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { EtlModule } from './modules/etl/etl.module';
import { BettingEngineModule } from './modules/betting-engine/betting-engine.module';
import { BacktestModule } from './modules/backtest/backtest.module';
import { NotificationModule } from './modules/notification/notification.module';
import { RiskModule } from './modules/risk/risk.module';
import { AdjustmentModule } from './modules/adjustment/adjustment.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { ReportsModule } from './modules/reports/reports.module';
import { FormationProgressModule } from './modules/formation-progress/formation-progress.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { SupportModule } from './modules/support/support.module';
import { PushModule } from './modules/push/push.module';
import { SlipDigestModule } from './modules/slip-digest/slip-digest.module';
import { ActivityModule } from './modules/activity/activity.module';
import { CouponModule } from './modules/coupon/coupon.module';
import { ScreensModule } from './modules/screens/screens.module';
import { VerifiedTicketModule } from './modules/verified-ticket/verified-ticket.module';
import { MlModule } from './modules/ml/ml.module';
import { AnalysisSheetModule } from './modules/analysis-sheet/analysis-sheet.module';
import { RedisModule } from './common/redis/redis.module';
import { validateEnv } from './config/env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: GLOBAL_RATE_LIMIT.ttlMs,
        limit: GLOBAL_RATE_LIMIT.limit,
      },
    ]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    RedisModule,
    PrismaModule,
    EtlModule,
    BettingEngineModule,
    BacktestModule,
    NotificationModule,
    RiskModule,
    AdjustmentModule,
    AuthModule,
    DashboardModule,
    AuditModule,
    AdminUsersModule,
    ReportsModule,
    FormationProgressModule,
    AnnouncementsModule,
    SupportModule,
    PushModule,
    SlipDigestModule,
    ActivityModule,
    CouponModule,
    ScreensModule,
    VerifiedTicketModule,
    AnalysisSheetModule,
    MlModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
