import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { CouponModule } from '@modules/coupon/coupon.module';
import { TodayController } from './today.controller';
import { TodayRepository } from './today.repository';
import { TodayService } from './today.service';

/**
 * One aggregate endpoint per player screen (16 § 3): the only place that
 * knows a screen's shape. Composes from repositories, returns a flat DTO.
 */
@Module({
  imports: [AuthModule, CouponModule],
  controllers: [TodayController],
  providers: [TodayService, TodayRepository],
})
export class ScreensModule {}
