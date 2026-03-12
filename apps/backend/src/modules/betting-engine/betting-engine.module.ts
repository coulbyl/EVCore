import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/prisma.module';
import { BettingEngineService } from './betting-engine.service';
import { BettingEngineController } from './betting-engine.controller';
import { H2HService } from './h2h.service';
import { CongestionService } from './congestion.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [BettingEngineController],
  providers: [BettingEngineService, H2HService, CongestionService],
  exports: [BettingEngineService],
})
export class BettingEngineModule {}
