import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { PrismaModule } from '@/prisma.module';
import { CouponRepository } from './coupon.repository';
import { CouponSettlementService } from './coupon-settlement.service';
import { CouponService } from './coupon.service';
import { CouponPriceGenerationService } from './coupon-price-generation.service';
import { CouponIndicesService } from './coupon-indices.service';
import { CouponController } from './coupon.controller';
import { OddsClosingLineRepository } from '../betting-engine/pricing/odds-closing-line.repository';

// CalibrationService/OddsSnapshotLoader/CouponPoolService/CouponComposerService
// removed 2026-09-03 — they existed here only for the retired write path
// (CouponComposerService.compose(), fed by CouponPoolService.getPoolForRange).
// CalibrationService/OddsSnapshotLoader are still registered in their real
// homes (adjustment.module.ts/betting-engine.module.ts) — this was a
// duplicate registration only CouponPoolService needed. See
// docs/vantage-centric-redesign-2026-09-01.md §9bis.
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CouponController],
  providers: [
    CouponRepository,
    // Lecteur de la vue `odds_closing_line`, sans état : enregistré ici et
    // dans betting-engine.module.ts plutôt que d'importer tout le moteur
    // pour une seule requête.
    OddsClosingLineRepository,
    CouponSettlementService,
    CouponService,
    CouponIndicesService,
    CouponPriceGenerationService,
  ],
  exports: [
    CouponService,
    CouponSettlementService,
    CouponRepository,
    CouponPriceGenerationService,
  ],
})
export class CouponModule {}
