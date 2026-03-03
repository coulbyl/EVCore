import { Module } from '@nestjs/common';
import { BettingEngineModule } from '@modules/betting-engine/betting-engine.module';
import { CouponModule } from '@modules/coupon/coupon.module';
import { NotificationModule } from '@modules/notification/notification.module';
import { AdjustmentController } from './adjustment.controller';
import { AdjustmentService } from './adjustment.service';
import { CalibrationService } from './calibration.service';

@Module({
  imports: [BettingEngineModule, NotificationModule, CouponModule],
  controllers: [AdjustmentController],
  providers: [AdjustmentService, CalibrationService],
  exports: [AdjustmentService, CalibrationService],
})
export class AdjustmentModule {}
