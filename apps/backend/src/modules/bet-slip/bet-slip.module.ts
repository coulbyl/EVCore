import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { BetSlipController } from './bet-slip.controller';
import { BetSlipRepository } from './bet-slip.repository';
import { BetSlipService } from './bet-slip.service';

@Module({
  imports: [AuthModule],
  controllers: [BetSlipController],
  providers: [BetSlipRepository, BetSlipService],
})
export class BetSlipModule {}
