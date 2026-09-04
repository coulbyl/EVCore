import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import {
  formatDateUtc,
  tomorrowUtc,
  parseIsoDate,
  endOfUtcDay,
} from '@utils/date.utils';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { CouponService } from './coupon.service';
import { CouponSettlementService } from './coupon-settlement.service';
import { CouponIndicesService } from './coupon-indices.service';
import { CouponQueryDto } from './dto/coupon-query.dto';
import { CouponIndicesQueryDto } from './dto/coupon-indices-query.dto';
import { CouponSettleRangeQueryDto } from './dto/coupon-settle-range-query.dto';
import type { CouponProposalDto } from './dto/coupon-proposal.dto';
import type { CouponIndicesResponse } from './dto/coupon-indices.dto';

@ApiTags('coupons')
@Controller('coupons')
export class CouponController {
  constructor(
    private readonly coupon: CouponService,
    private readonly settlement: CouponSettlementService,
    private readonly indices: CouponIndicesService,
  ) {}

  @Get()
  @UseGuards(AuthSessionGuard)
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
    @CurrentSession() session: AuthSession,
    @Query() query: CouponQueryDto,
  ): Promise<CouponProposalDto[]> {
    const date = query.date ?? formatDateUtc(tomorrowUtc());
    return this.coupon.getCoupons(date, session.user.id, undefined);
  }

  @Post(':id/view')
  @UseGuards(AuthSessionGuard)
  @HttpCode(204)
  @ApiOperation({
    summary: 'Record that the current user has seen this coupon',
    description:
      'Idempotent — a repeat view from the same user is a no-op. Backs the ' +
      'real "N vues" count shown on the coupon card (never a fabricated ' +
      'social-proof number).',
  })
  @ApiParam({ name: 'id', description: 'UUID of the CouponProposal.' })
  @ApiNoContentResponse({ description: 'View recorded (or already was).' })
  @ApiNotFoundResponse({ description: 'No proposal found with the given ID.' })
  async recordView(
    @CurrentSession() session: AuthSession,
    @Param('id') id: string,
  ): Promise<void> {
    await this.coupon.recordView(id, session.user.id);
  }

  // POST /coupons/generate retired 2026-09-03 alongside CouponComposerService
  // — coupon composition is now apps/vantage-worker's own LLM pipeline,
  // triggered by its own scheduler, not by an HTTP call into this app. See
  // docs/vantage-centric-redesign-2026-09-01.md §9bis.

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
