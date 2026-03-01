import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { EtlModule } from './modules/etl/etl.module';
import { RollingStatsModule } from './modules/rolling-stats/rolling-stats.module';
import { BettingEngineModule } from './modules/betting-engine/betting-engine.module';
import { BacktestModule } from './modules/backtest/backtest.module';
import { NotificationModule } from './modules/notification/notification.module';
import { RiskModule } from './modules/risk/risk.module';
import { AdjustmentModule } from './modules/adjustment/adjustment.module';

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
    PrismaModule,
    EtlModule,
    RollingStatsModule,
    BettingEngineModule,
    BacktestModule,
    NotificationModule,
    RiskModule,
    AdjustmentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
