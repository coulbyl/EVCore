import { Controller, Get, Post, Param, Query, HttpCode } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { formatDateUtc, tomorrowUtc } from '@utils/date.utils';
import { CouponService } from './coupon.service';
import { CouponSettlementService } from './coupon-settlement.service';
import { CouponSummaryService } from './coupon-summary.service';
import { CouponIndicesService } from './coupon-indices.service';
import { CouponQueryDto } from './dto/coupon-query.dto';
import { CouponSummaryQueryDto } from './dto/coupon-summary-query.dto';
import { CouponIndicesQueryDto } from './dto/coupon-indices-query.dto';
import type { CouponProposalDto } from './dto/coupon-proposal.dto';
import type { CouponSummaryResponse } from './dto/coupon-summary.dto';
import type { CouponIndicesResponse } from './dto/coupon-indices.dto';

@ApiTags('coupons')
@Controller('coupons')
export class CouponController {
  // eslint-disable-next-line max-params
  constructor(
    private readonly coupon: CouponService,
    private readonly settlement: CouponSettlementService,
    private readonly summary: CouponSummaryService,
    private readonly indices: CouponIndicesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get coupon proposals for a date',
    description:
      'Returns all generated coupon proposals (all statuses) for the given date. Defaults to tomorrow (UTC) when no date is provided.',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description:
      'Target date in YYYY-MM-DD format (UTC). Defaults to tomorrow.',
    example: '2026-05-17',
  })
  @ApiOkResponse({ description: 'List of coupon proposals with their legs.' })
  async getCoupons(
    @Query() query: CouponQueryDto,
  ): Promise<CouponProposalDto[]> {
    const date = query.date ?? formatDateUtc(tomorrowUtc());
    return this.coupon.getCoupons(date, undefined);
  }

  @Post('generate')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Manually trigger coupon generation for a date',
    description:
      'Runs the full coupon-generation pipeline for the target date. Idempotent: existing proposals for that date are replaced. Defaults to tomorrow (UTC).',
  })
  @ApiQuery({ name: 'date', required: false, example: '2026-05-17' })
  @ApiQuery({ name: 'windowDays', required: false, example: 14 })
  @ApiOkResponse({
    description: 'Generation completed successfully.',
    schema: {
      type: 'object',
      properties: { generated: { type: 'boolean', example: true } },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
  async generate(
    @Query() query: CouponQueryDto,
  ): Promise<{ generated: boolean }> {
    const date = query.date ?? formatDateUtc(tomorrowUtc());
    await this.coupon.generateCoupons(date, { windowDays: query.windowDays });
    return { generated: true };
  }

  @Post('settle')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Settle all ready proposals',
    description:
      'Scans all PENDING proposals whose last fixture has a final result and settles them. Safe to call multiple times.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { settled: { type: 'boolean', example: true } },
    },
  })
  async settle(): Promise<{ settled: boolean }> {
    await this.settlement.settleReadyProposals();
    return { settled: true };
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Coupon summary — resolved picks or coupons over a date range',
  })
  @ApiOkResponse({ description: 'Summary data.' })
  async getSummary(
    @Query() query: CouponSummaryQueryDto,
  ): Promise<CouponSummaryResponse> {
    return this.summary.getCouponSummary({
      canal: query.canal,
      from: query.from,
      to: query.to,
    });
  }

  @Get('indices')
  @ApiOperation({
    summary: 'Coupon probability indices — hit rate by probability bucket',
  })
  @ApiOkResponse({ description: 'Probability indices data.' })
  async getIndices(
    @Query() query: CouponIndicesQueryDto,
  ): Promise<CouponIndicesResponse> {
    return this.indices.getIndices({
      canal: query.canal,
      from: query.from,
      to: query.to,
    });
  }

  @Post(':id/settle')
  @HttpCode(200)
  @ApiOperation({ summary: 'Settle a specific proposal' })
  @ApiParam({ name: 'id', description: 'UUID of the CouponProposal.' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { settled: { type: 'boolean', example: true } },
    },
  })
  @ApiNotFoundResponse({ description: 'No proposal found with the given ID.' })
  async settleOne(@Param('id') id: string): Promise<{ settled: boolean }> {
    await this.settlement.settleProposal(id);
    return { settled: true };
  }
}
