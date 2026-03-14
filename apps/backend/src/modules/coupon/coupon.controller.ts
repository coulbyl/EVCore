import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CouponService } from './coupon.service';
import { tomorrowUtc } from '@utils/date.utils';
import { GenerateCouponDto } from './dto/generate-coupon.dto';

@ApiTags('Coupon')
@Controller('coupon')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger coupon generation',
    description:
      'Manually triggers coupon generation for a given date and window. ' +
      'Omit the body to generate for tomorrow UTC with a 1-day window.',
  })
  @ApiBody({ type: GenerateCouponDto, required: false })
  async generate(@Body() body: GenerateCouponDto = {}) {
    const startDate = body.date ? new Date(body.date) : tomorrowUtc();
    await this.couponService.generateCouponWindow({
      startDate,
      days: body.days ?? 1,
    });
    return { status: 'ok' as const };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get coupon by ID with legs detail' })
  @ApiParam({ name: 'id', description: 'Coupon UUID' })
  async getCoupon(@Param('id') couponId: string) {
    const coupon = await this.couponService.getCouponById(couponId);
    if (!coupon) throw new NotFoundException(`Coupon ${couponId} not found`);
    return coupon;
  }

  @Post(':id/settle')
  settleCoupon(@Param('id') couponId: string) {
    return this.couponService.settleCouponById(couponId);
  }
}
