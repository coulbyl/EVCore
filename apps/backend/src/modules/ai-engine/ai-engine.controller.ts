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
import { AiEngineService } from './ai-engine.service';
import { CouponSettlementService } from './coupon-settlement.service';
import { InvestmentService } from './investment.service';
import { CouponQueryDto } from './dto/coupon-query.dto';
import type { CouponProposalDto } from './dto/coupon-proposal.dto';
import type { InvestmentDayDto } from './dto/investment-day.dto';

@ApiTags('ai-engine')
@Controller('ai-engine')
export class AiEngineController {
  constructor(
    private readonly aiEngine: AiEngineService,
    private readonly settlement: CouponSettlementService,
    private readonly investment: InvestmentService,
  ) {}

  @Get('coupons')
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
  @ApiOkResponse({
    description:
      'List of coupon proposals with their legs and settlement status.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          forDate: { type: 'string', format: 'date', example: '2026-05-17' },
          rank: { type: 'integer', example: 1 },
          signalWindowDays: { type: 'integer', example: 14 },
          targetOddsMin: { type: 'number', example: 2.0 },
          targetOddsMax: { type: 'number', example: 10.0 },
          combinedOdds: { type: 'number', example: 4.75 },
          jointProbability: { type: 'number', example: 0.21 },
          signalScore: { type: 'number', example: 0.68 },
          status: {
            type: 'string',
            enum: ['PENDING', 'SETTLED', 'CANCELLED'],
            example: 'PENDING',
          },
          result: {
            type: 'string',
            nullable: true,
            enum: ['WIN', 'LOSS', null],
            example: null,
          },
          reasoning: { type: 'object', nullable: true },
          lastFixtureScheduledAt: { type: 'string', format: 'date-time' },
          generatedAt: { type: 'string', format: 'date-time' },
          legs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                fixtureId: { type: 'string', format: 'uuid' },
                homeTeam: { type: 'string', example: 'Arsenal' },
                awayTeam: { type: 'string', example: 'Chelsea' },
                competition: { type: 'string', example: 'Premier League' },
                scheduledAt: { type: 'string', format: 'date-time' },
                canal: {
                  type: 'string',
                  enum: ['EV', 'SV', 'CONFIANCE', 'BTTS', 'NUL'],
                },
                market: { type: 'string', example: 'MATCH_WINNER' },
                pick: { type: 'string', example: 'HOME' },
                probability: { type: 'number', example: 0.55 },
                oddsSnapshot: { type: 'number', nullable: true, example: 1.9 },
                signalScore: { type: 'number', example: 0.72 },
                isCorrect: { type: 'boolean', nullable: true, example: null },
              },
            },
          },
        },
      },
    },
  })
  async getCoupons(
    @Query() query: CouponQueryDto,
  ): Promise<CouponProposalDto[]> {
    const date = query.date ?? formatDateUtc(tomorrowUtc());
    const status = undefined; // all statuses by default
    return this.aiEngine.getCoupons(date, status);
  }

  @Post('coupons/generate')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Manually trigger coupon generation for a date',
    description:
      'Runs the full coupon-generation pipeline for the target date. Idempotent: existing proposals for that date are replaced. Defaults to tomorrow (UTC).',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description:
      'Target date in YYYY-MM-DD format (UTC). Defaults to tomorrow.',
    example: '2026-05-17',
  })
  @ApiQuery({
    name: 'windowDays',
    required: false,
    description:
      'Historical signal window in days used to score legs (min 7, max 60).',
    example: 14,
  })
  @ApiQuery({
    name: 'oddsMin',
    required: false,
    description: 'Minimum combined odds filter for generated coupons (min 2).',
    example: 2.0,
  })
  @ApiQuery({
    name: 'oddsMax',
    required: false,
    description:
      'Maximum combined odds filter for generated coupons (max 200).',
    example: 10.0,
  })
  @ApiOkResponse({
    description: 'Generation completed successfully.',
    schema: {
      type: 'object',
      properties: { generated: { type: 'boolean', example: true } },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid query parameters (date format, range violations).',
  })
  async generate(
    @Query() query: CouponQueryDto,
  ): Promise<{ generated: boolean }> {
    const date = query.date ?? formatDateUtc(tomorrowUtc());
    await this.aiEngine.generateCoupons(date, { windowDays: query.windowDays });
    return { generated: true };
  }

  @Post('coupons/settle')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Settle all ready proposals',
    description:
      'Scans all PENDING proposals whose last fixture has a final result and settles them. Safe to call multiple times — already-settled proposals are skipped.',
  })
  @ApiOkResponse({
    description: 'Settlement pass completed.',
    schema: {
      type: 'object',
      properties: { settled: { type: 'boolean', example: true } },
    },
  })
  async settle(): Promise<{ settled: boolean }> {
    await this.settlement.settleReadyProposals();
    return { settled: true };
  }

  @Get('investment')
  @ApiOperation({
    summary: 'Get investment day — top picks + coupons',
    description:
      'Returns the investment analysis for a given date: top picks per canal (AI-curated or deterministic fallback) and up to 3 composed coupons. Defaults to today (UTC) when no date is provided.',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    example: '2026-05-20',
    description: 'YYYY-MM-DD (UTC). Defaults to today.',
  })
  @ApiOkResponse({ description: 'Investment day data.' })
  async getInvestment(@Query('date') date?: string): Promise<InvestmentDayDto> {
    const d = date ?? formatDateUtc(new Date());
    return this.investment.getInvestmentDay(d);
  }

  @Post('coupons/:id/settle')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Settle a specific proposal',
    description:
      'Forces settlement of a single coupon proposal by ID, regardless of its current status. Use for manual overrides after data corrections.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the CouponProposal to settle.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiOkResponse({
    description: 'Proposal settled successfully.',
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
