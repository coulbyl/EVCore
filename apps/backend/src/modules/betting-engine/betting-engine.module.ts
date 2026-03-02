import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/prisma.module';
import { BettingEngineService } from './betting-engine.service';
import { BettingEngineController } from './betting-engine.controller';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [BettingEngineController],
  providers: [BettingEngineService],
  exports: [BettingEngineService],
})
export class BettingEngineModule {}
