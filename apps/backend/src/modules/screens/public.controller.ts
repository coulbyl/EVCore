import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RESULTS_DEFAULT_PERIOD } from '@config/results.constants';
import { PUBLIC_CACHE_CONTROL } from '@config/screens.constants';
import { ResultsQueryDto } from './dto/results-query.dto';
import { PublicService, type PublicToday } from './public.service';
import { ResultsService } from './results.service';
import type { AiDetail, ProductDetail, ResultsScreen } from './results.types';

/**
 * Without a session (docs/refonte-ui/11 § 1): the landing's hero and the
 * share image, and /resultats, the compliance page where everything the
 * landing claims can be checked. Cached by the edge (16 § 3).
 */
@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(
    private readonly publicScreens: PublicService,
    private readonly results: ResultsService,
  ) {}

  @Get('today')
  @Header('Cache-Control', PUBLIC_CACHE_CONTROL)
  @ApiOperation({
    summary: "Today's hero for visitors and the share image",
    description:
      "The coupon of the day without player state, its product's 30-day form, yesterday's line, today's abstentions, the first lines of Résultats and the AI. Never the legs of every product.",
  })
  @ApiOkResponse({ description: 'The landing.' })
  getToday(): Promise<PublicToday> {
    return this.publicScreens.getToday();
  }

  @Get('results/products')
  @Header('Cache-Control', PUBLIC_CACHE_CONTROL)
  @ApiOperation({ summary: 'Résultats, read-only, for /resultats' })
  @ApiOkResponse({ description: 'One line per product, then the AI.' })
  getResults(@Query() query: ResultsQueryDto): Promise<ResultsScreen> {
    return this.results.getResults({
      period: query.period ?? RESULTS_DEFAULT_PERIOD,
      isAdmin: false,
    });
  }

  @Get('results/ai')
  @Header('Cache-Control', PUBLIC_CACHE_CONTROL)
  @ApiOperation({ summary: '« Avis IA » opened, read-only, for /resultats' })
  @ApiOkResponse({ description: 'The AI detail.' })
  getAi(@Query() query: ResultsQueryDto): Promise<AiDetail> {
    return this.results.getAi({
      period: query.period ?? RESULTS_DEFAULT_PERIOD,
    });
  }

  @Get('results/products/:product')
  @Header('Cache-Control', PUBLIC_CACHE_CONTROL)
  @ApiOperation({ summary: "A product's detail, read-only, for /resultats" })
  @ApiOkResponse({ description: 'The detail.' })
  getProduct(
    @Param('product') product: string,
    @Query() query: ResultsQueryDto,
  ): Promise<ProductDetail> {
    return this.results.getProduct({
      product,
      period: query.period ?? RESULTS_DEFAULT_PERIOD,
      isAdmin: false,
    });
  }
}
