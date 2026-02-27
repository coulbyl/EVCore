import { Module } from '@nestjs/common';
import { BettingEngineService } from './betting-engine.service';

@Module({
  providers: [BettingEngineService],
  exports: [BettingEngineService],
})
export class BettingEngineModule {}
