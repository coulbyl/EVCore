import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { BettingEngineModule } from '@modules/betting-engine/betting-engine.module';
import { AuthModule } from '@modules/auth/auth.module';
import { InvestmentController } from './investment.controller';
import { InvestmentService } from './investment.service';
import { InvestmentCalibrationRepository } from './investment-calibration.repository';
import { InvestmentCoherenceRepository } from './investment-coherence.repository';

@Module({
  imports: [PrismaModule, BettingEngineModule, AuthModule],
  controllers: [InvestmentController],
  providers: [
    InvestmentService,
    InvestmentCalibrationRepository,
    InvestmentCoherenceRepository,
  ],
})
export class InvestmentModule {}
