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
import {
  formatDateUtc,
  tomorrowUtc,
  parseIsoDate,
  endOfUtcDay,
} from '@utils/date.utils';
import { CouponService } from './coupon.service';
import { CouponSettlementService } from './coupon-settlement.service';
import { CouponSummaryService } from './coupon-summary.service';
import { CouponIndicesService } from './coupon-indices.service';
import { CouponRoiService } from './coupon-roi.service';
import { CouponQueryDto } from './dto/coupon-query.dto';
import { CouponSummaryQueryDto } from './dto/coupon-summary-query.dto';
import { CouponIndicesQueryDto } from './dto/coupon-indices-query.dto';
import { CouponRoiQueryDto } from './dto/coupon-roi-query.dto';
import { CouponSettleRangeQueryDto } from './dto/coupon-settle-range-query.dto';
import type { CouponProposalDto } from './dto/coupon-proposal.dto';
import type { CouponSummaryResponse } from './dto/coupon-summary.dto';
import type { CouponIndicesResponse } from './dto/coupon-indices.dto';
import type { CouponRoiResponse } from './dto/coupon-roi.dto';

@ApiTags('coupons')
@Controller('coupons')
export class CouponController {
  // eslint-disable-next-line max-params
  constructor(
    private readonly coupon: CouponService,
    private readonly settlement: CouponSettlementService,
    private readonly summary: CouponSummaryService,
    private readonly indices: CouponIndicesService,
    private readonly roi: CouponRoiService,
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

  @Get('roi')
  @ApiOperation({
    summary: 'Rolling ROI by channel × EV-bin (channel promotion tool)',
    description:
      'Flat-stake ROI over a date window, grouped by strategy channel and EV bin, read from settled channel_selection. A `promote` flag highlights +ROI bins with a large-enough sample. Defaults to the last 90 days.',
  })
  @ApiQuery({ name: 'from', required: false, example: '2026-03-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-06-01' })
  @ApiOkResponse({ description: 'ROI breakdown by channel and EV bin.' })
  async getRoi(@Query() query: CouponRoiQueryDto): Promise<CouponRoiResponse> {
    return this.roi.getRoiByChannel({ from: query.from, to: query.to });
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

  @Post('settle-range')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Force re-settlement of every proposal in a forDate range',
    description:
      'Re-runs settlement for all proposals (any status, including already-EXPIRED) ' +
      'whose forDate falls within [from, to]. Idempotent and safe to re-run — use as ' +
      'catch-up after a settlement bug fix, when you do not have individual proposal IDs.',
  })
  @ApiQuery({ name: 'from', required: true, example: '2026-07-01' })
  @ApiQuery({ name: 'to', required: true, example: '2026-07-15' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { resettled: { type: 'number', example: 12 } },
    },
  })
  async settleRange(
    @Query() query: CouponSettleRangeQueryDto,
  ): Promise<{ resettled: number }> {
    const from = parseIsoDate(query.from);
    const to = endOfUtcDay(parseIsoDate(query.to));
    return this.settlement.settleRange(from, to);
  }
}
