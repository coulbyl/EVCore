import { Controller, Get, Post, Param, Query, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { formatDateUtc, tomorrowUtc } from '@utils/date.utils';
import { AiEngineService } from './ai-engine.service';
import { CouponSettlementService } from './coupon-settlement.service';
import { CouponQueryDto } from './dto/coupon-query.dto';
import type { CouponProposalDto } from './dto/coupon-proposal.dto';

@ApiTags('ai-engine')
@Controller('ai-engine')
export class AiEngineController {
  constructor(
    private readonly aiEngine: AiEngineService,
    private readonly settlement: CouponSettlementService,
  ) {}

  @Get('coupons')
  @ApiOperation({ summary: 'Get coupon proposals for a date' })
  async getCoupons(
    @Query() query: CouponQueryDto,
  ): Promise<CouponProposalDto[]> {
    const date = query.date ?? formatDateUtc(tomorrowUtc());
    const status = undefined; // all statuses by default
    return this.aiEngine.getCoupons(date, status);
  }

  @Post('coupons/generate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Manually trigger coupon generation for a date' })
  async generate(
    @Query() query: CouponQueryDto,
  ): Promise<{ generated: boolean }> {
    const date = query.date ?? formatDateUtc(tomorrowUtc());
    await this.aiEngine.generateCoupons(
      date,
      query.windowDays,
      query.oddsMin,
      query.oddsMax,
    );
    return { generated: true };
  }

  @Post('coupons/settle')
  @HttpCode(200)
  @ApiOperation({ summary: 'Manually trigger settlement of ready proposals' })
  async settle(): Promise<{ settled: boolean }> {
    await this.settlement.settleReadyProposals();
    return { settled: true };
  }

  @Post('coupons/:id/settle')
  @HttpCode(200)
  @ApiOperation({ summary: 'Settle a specific proposal' })
  async settleOne(@Param('id') id: string): Promise<{ settled: boolean }> {
    await this.settlement.settleProposal(id);
    return { settled: true };
  }
}
