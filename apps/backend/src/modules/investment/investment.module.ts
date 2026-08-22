import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { BettingEngineModule } from '@modules/betting-engine/betting-engine.module';
import { AuthModule } from '@modules/auth/auth.module';
import { InvestmentController } from './investment.controller';
import { InvestmentService } from './investment.service';
import { InvestmentChannelStatsRepository } from './investment-channel-stats.repository';
import { InvestmentCoherenceRepository } from './investment-coherence.repository';

@Module({
  imports: [PrismaModule, BettingEngineModule, AuthModule],
  controllers: [InvestmentController],
  providers: [
    InvestmentService,
    InvestmentChannelStatsRepository,
    InvestmentCoherenceRepository,
  ],
  exports: [InvestmentService],
})
export class InvestmentModule {}
