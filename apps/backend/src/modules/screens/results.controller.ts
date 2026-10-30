import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RESULTS_DEFAULT_PERIOD } from '@config/results.constants';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { ResultsQueryDto } from './dto/results-query.dto';
import { ResultsService } from './results.service';
import { WeekQueryDto } from './dto/week-query.dto';
import { WeekService, type WeekScreen } from './week.service';
import type { ProductDetail, ResultsScreen } from './results.types';

/**
 * « Résultats ». It proposes nothing to play: it stays open during a pause
 * (08 § 4), so no PausedGuard. Admins also see the retired products.
 */
@ApiTags('screens')
@Controller('results')
@UseGuards(AuthSessionGuard)
export class ResultsController {
  constructor(
    private readonly results: ResultsService,
    private readonly weeks: WeekService,
  ) {}

  @Get('products')
  @ApiOperation({
    summary: 'What each product gave over the period, and the AI',
    description:
      'Days won, lost and refunded, days without a coupon, worst losing streak, the last ten days played, announced against realised on the same days, and the francs at 1 000 F a day at the 1xBet odds really paid.',
  })
  @ApiOkResponse({ description: 'One line per product, then the AI.' })
  getResults(
    @CurrentSession() session: AuthSession,
    @Query() query: ResultsQueryDto,
  ): Promise<ResultsScreen> {
    return this.results.getResults({
      period: query.period ?? RESULTS_DEFAULT_PERIOD,
      isAdmin: session.user.role === 'ADMIN',
    });
  }

  @Get('week')
  @ApiOperation({
    summary:
      '« Ta semaine »: the week of each product and of my followed coupons',
    description:
      "Monday to Sunday, each product's mark per day and its days won over played (a refund is neither), counted as the Monday statement; and the player's followed coupons whose last match was that week.",
  })
  @ApiOkResponse({ description: 'The week.' })
  getWeek(
    @CurrentSession() session: AuthSession,
    @Query() query: WeekQueryDto,
  ): Promise<WeekScreen> {
    return this.weeks.getWeek({ userId: session.user.id, week: query.week });
  }

  @Get('products/:product')
  @ApiOperation({
    summary: "A product's detail: its grid and its days",
    description:
      'The summary of the list, a cell per calendar day of the period, and the days most recent first, abstentions with their reason.',
  })
  @ApiOkResponse({ description: 'The detail.' })
  getProduct(
    @CurrentSession() session: AuthSession,
    @Param('product') product: string,
    @Query() query: ResultsQueryDto,
  ): Promise<ProductDetail> {
    return this.results.getProduct({
      product,
      period: query.period ?? RESULTS_DEFAULT_PERIOD,
      isAdmin: session.user.role === 'ADMIN',
    });
  }
}
