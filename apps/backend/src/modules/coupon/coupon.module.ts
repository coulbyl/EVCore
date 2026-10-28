import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { PrismaModule } from '@/prisma.module';
import { CouponRepository } from './coupon.repository';
import { CouponFollowRepository } from './coupon-follow.repository';
import { CouponSettlementService } from './coupon-settlement.service';
import { CouponService } from './coupon.service';
import { CouponPriceGenerationService } from './coupon-price-generation.service';
import { CouponFavouriteGenerationService } from './coupon-favourite-generation.service';
import { CouponHunterGenerationService } from './coupon-hunter-generation.service';
import { CouponDoubleGenerationService } from './coupon-double-generation.service';
import { CouponDailyGenerationService } from './coupon-daily-generation.service';
import { CouponEngineComboGenerationService } from './coupon-engine-combo-generation.service';
import { CouponIndicesService } from './coupon-indices.service';
import { CouponController } from './coupon.controller';
import { OddsClosingLineRepository } from '../betting-engine/pricing/odds-closing-line.repository';
import { PlayableOddsRepository } from '../betting-engine/pricing/playable-odds.repository';

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
    CouponFollowRepository,
    // Lecteur de la vue `odds_closing_line`, sans état : enregistré ici et
    // dans betting-engine.module.ts plutôt que d'importer tout le moteur
    // pour une seule requête.
    OddsClosingLineRepository,
    PlayableOddsRepository,
    CouponSettlementService,
    CouponService,
    CouponIndicesService,
    CouponPriceGenerationService,
    CouponFavouriteGenerationService,
    CouponDoubleGenerationService,
    CouponHunterGenerationService,
    CouponEngineComboGenerationService,
    CouponDailyGenerationService,
  ],
  exports: [
    CouponService,
    CouponSettlementService,
    CouponRepository,
    CouponPriceGenerationService,
    CouponFavouriteGenerationService,
    CouponDailyGenerationService,
  ],
})
export class CouponModule {}
