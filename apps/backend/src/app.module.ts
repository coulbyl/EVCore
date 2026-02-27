import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NovuService } from './novu.service';
import { PrismaModule } from './prisma.module';
import { EtlModule } from './modules/etl/etl.module';
import { RollingStatsModule } from './modules/rolling-stats/rolling-stats.module';

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
  ],
  controllers: [AppController],
  providers: [AppService, NovuService],
})
export class AppModule {}
