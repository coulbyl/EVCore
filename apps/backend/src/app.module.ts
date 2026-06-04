import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
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
import { BetSlipModule } from './modules/bet-slip/bet-slip.module';
import { BetModule } from './modules/bet/bet.module';
import { BankrollModule } from './modules/bankroll/bankroll.module';
import { PredictionModule } from './modules/prediction/prediction.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { FormationProgressModule } from './modules/formation-progress/formation-progress.module';
import { SummaryModule } from './modules/summary/summary.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { AiEngineModule } from './modules/ai-engine/ai-engine.module';
import { MlModule } from './modules/ml/ml.module';
import { RedisModule } from './common/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    BetSlipModule,
    BetModule,
    BankrollModule,
    PredictionModule,
    DashboardModule,
    AuditModule,
    GamificationModule,
    AdminUsersModule,
    FormationProgressModule,
    SummaryModule,
    AnnouncementsModule,
    AiEngineModule,
    MlModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
