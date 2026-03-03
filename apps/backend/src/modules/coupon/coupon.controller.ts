import { Controller, Param, Post } from '@nestjs/common';
import { CouponService } from './coupon.service';

@Controller('coupon')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Post(':id/settle')
  settleCoupon(@Param('id') couponId: string) {
    return this.couponService.settleCouponById(couponId);
  }
}
