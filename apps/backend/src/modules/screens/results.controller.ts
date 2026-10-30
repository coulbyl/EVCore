import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RESULTS_DEFAULT_PERIOD } from '@config/results.constants';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { ResultsQueryDto } from './dto/results-query.dto';
import { ResultsService } from './results.service';
import type { ProductDetail, ResultsScreen } from './results.types';

/**
 * « Résultats ». It proposes nothing to play: it stays open during a pause
 * (08 § 4), so no PausedGuard. Admins also see the retired products.
 */
@ApiTags('screens')
@Controller('results/products')
@UseGuards(AuthSessionGuard)
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Get()
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

  @Get(':product')
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
