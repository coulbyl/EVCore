import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Body,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '@/common/guards/admin.guard';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import type { PassView } from './console-passes';
import { ResultsQueryDto } from '@modules/screens/dto/results-query.dto';
import { RESULTS_DEFAULT_PERIOD } from '@config/results.constants';
import { ConsoleEngineService } from './console-engine.service';
import { ConsolePassesService } from './console-passes.service';
import { ConsoleService } from './console.service';
import { ReactivateMarketDto } from './dto/reactivate.dto';
import type {
  ChannelCell,
  ConsoleStatus,
  EngineProducts,
  SuspendedMarket,
} from './console.types';

/** The admin (docs/refonte-ui/12-admin.md). Admin accounts only. */
@ApiTags('console')
@Controller('console')
@UseGuards(AuthSessionGuard, AdminGuard)
export class ConsoleController {
  constructor(
    private readonly console: ConsoleService,
    private readonly passes: ConsolePassesService,
    private readonly engine: ConsoleEngineService,
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'The three lights and « À faire »',
    description:
      'Données, Moteur, Joueurs: green, orange or red by the rules written once in console.constants.ts; « À faire » lists what the system found, reds first, each with its figures.',
  })
  @ApiOkResponse({ description: 'The lights and the lines.' })
  getStatus(): Promise<ConsoleStatus> {
    return this.console.getStatus();
  }

  @Get('passes')
  @ApiOperation({
    summary: "Les passes d'aujourd'hui",
    description:
      'Each scheduled pass of the day with its time, its last run read from its queue, running, failed (with the queue message), waiting or missed, and whether it can be relaunched.',
  })
  @ApiOkResponse({ description: 'The passes, in the order of the day.' })
  getPasses(): Promise<PassView[]> {
    return this.passes.getPasses();
  }

  @Post('passes/:key/relaunch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Relancer a pass',
    description:
      'Adds the same job as the schedule. Refused (409) while it runs, once done, and for the morning brief, which writes to every player.',
  })
  @ApiOkResponse({ description: 'The pass after the relaunch.' })
  relaunch(@Param('key') key: string): Promise<PassView> {
    return this.passes.relaunch(key);
  }

  @Get('engine/products')
  @ApiOperation({
    summary: 'Moteur › Produits',
    description:
      "Résultats' products with the retired ones, announced against realised, and what a player never sees: legs, mean closing line value, mean 1xBet margin; the AI with its record by configuration version.",
  })
  @ApiOkResponse({ description: 'The products and the AI.' })
  getEngineProducts(@Query() query: ResultsQueryDto): Promise<EngineProducts> {
    return this.engine.getProducts(query.period ?? RESULTS_DEFAULT_PERIOD);
  }

  @Get('engine/channels')
  @ApiOperation({
    summary: 'Moteur › Canaux × compétition',
    description:
      '90 rolling days of settled legs, deduplicated: ratio realised/announced with its 95 % interval and its word (conforme, optimistic, alert, not_enough), alerts first.',
  })
  @ApiOkResponse({ description: 'The cells.' })
  getChannels(): Promise<ChannelCell[]> {
    return this.engine.getChannels();
  }

  @Get('engine/suspensions')
  @ApiOperation({ summary: 'Moteur › Marchés suspendus' })
  @ApiOkResponse({ description: 'The active suspensions, oldest first.' })
  getSuspensions(): Promise<SuspendedMarket[]> {
    return this.engine.getSuspensions();
  }

  @Post('engine/suspensions/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Réactiver a suspended market',
    description:
      'A human decision with its reason; never automatic. 404 when unknown or already lifted.',
  })
  @ApiOkResponse({ description: 'The suspension lifted.' })
  reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReactivateMarketDto,
  ): Promise<SuspendedMarket> {
    return this.engine.reactivate({ id, reason: body.reason });
  }
}
