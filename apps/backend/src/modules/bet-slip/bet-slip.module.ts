import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { BankrollModule } from '@modules/bankroll/bankroll.module';
import { BetSlipController } from './bet-slip.controller';
import { BetSlipRepository } from './bet-slip.repository';
import { BetSlipService } from './bet-slip.service';
import { PlayableOddsRepository } from '../betting-engine/pricing/playable-odds.repository';

@Module({
  imports: [AuthModule, BankrollModule],
  controllers: [BetSlipController],
  providers: [BetSlipRepository, BetSlipService, PlayableOddsRepository],
})
export class BetSlipModule {}
