import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { CouponRepository } from './coupon.repository';
import { CouponSettlementService } from './coupon-settlement.service';
import { CouponService } from './coupon.service';
import { CouponSummaryService } from './coupon-summary.service';
import { CouponIndicesService } from './coupon-indices.service';
import { CouponRoiService } from './coupon-roi.service';
import { CouponController } from './coupon.controller';

// CalibrationService/OddsSnapshotLoader/CouponPoolService/CouponComposerService
// removed 2026-09-03 — they existed here only for the retired write path
// (CouponComposerService.compose(), fed by CouponPoolService.getPoolForRange).
// CalibrationService/OddsSnapshotLoader are still registered in their real
// homes (adjustment.module.ts/betting-engine.module.ts) — this was a
// duplicate registration only CouponPoolService needed. See
// docs/vantage-centric-redesign-2026-09-01.md §9bis.
@Module({
  imports: [PrismaModule],
  controllers: [CouponController],
  providers: [
    CouponRepository,
    CouponSettlementService,
    CouponService,
    CouponSummaryService,
    CouponIndicesService,
    CouponRoiService,
  ],
  exports: [CouponService, CouponSettlementService, CouponRepository],
})
export class CouponModule {}
