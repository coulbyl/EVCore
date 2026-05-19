import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { AiEngineRepository } from './ai-engine.repository';
import { SignalWindowService } from './signal-window.service';
import { CouponComposerService } from './coupon-composer.service';
import { CouponSettlementService } from './coupon-settlement.service';
import { AiEngineService } from './ai-engine.service';
import { InvestmentService } from './investment.service';
import { AiEngineController } from './ai-engine.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AiEngineController],
  providers: [
    AiEngineRepository,
    SignalWindowService,
    CouponComposerService,
    CouponSettlementService,
    AiEngineService,
    InvestmentService,
  ],
  exports: [AiEngineService, CouponSettlementService, InvestmentService],
})
export class AiEngineModule {}
