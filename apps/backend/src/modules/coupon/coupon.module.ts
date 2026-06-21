import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { CalibrationService } from '@modules/adjustment/calibration.service';
import { OddsSnapshotLoader } from '@modules/betting-engine/pricing/odds-snapshot.loader';
import { CouponRepository } from './coupon.repository';
import { SignalWindowService } from './signal-window.service';
import { CouponComposerService } from './coupon-composer.service';
import { CouponSettlementService } from './coupon-settlement.service';
import { CouponService } from './coupon.service';
import { CouponSummaryService } from './coupon-summary.service';
import { CouponIndicesService } from './coupon-indices.service';
import { CouponRoiService } from './coupon-roi.service';
import { CouponController } from './coupon.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CouponController],
  providers: [
    CalibrationService,
    OddsSnapshotLoader,
    CouponRepository,
    SignalWindowService,
    CouponComposerService,
    CouponSettlementService,
    CouponService,
    CouponSummaryService,
    CouponIndicesService,
    CouponRoiService,
  ],
  exports: [
    CouponService,
    CouponSettlementService,
    SignalWindowService,
    CouponComposerService,
  ],
})
export class CouponModule {}
