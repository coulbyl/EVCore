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
import { ConsolePlayersService } from './console-players.service';
import {
  PlayersAccountsQueryDto,
  PlayersMonthQueryDto,
} from './dto/players-query.dto';
import { ConsolePassesService } from './console-passes.service';
import { ConsoleService } from './console.service';
import { ReactivateMarketDto } from './dto/reactivate.dto';
import type {
  ChannelCell,
  ConsoleStatus,
  EngineProducts,
  PlayerAccount,
  PlayerSheet,
  PlayersMonth,
  SuspendedMarket,
} from './console.types';

/** The admin (docs/refonte-ui/12-admin.md). Admin accounts only. */
@ApiTags('console')
@Controller('console')
@UseGuards(AuthSessionGuard, AdminGuard)
export class ConsoleController {
  // eslint-disable-next-line max-params -- NestJS constructor injection: the home, its passes, Moteur, Joueurs
  constructor(
    private readonly console: ConsoleService,
    private readonly passes: ConsolePassesService,
    private readonly engine: ConsoleEngineService,
    private readonly players: ConsolePlayersService,
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

  @Get('players/month')
  @ApiOperation({
    summary: 'Joueurs › Ce mois',
    description:
      'Players only: sign-ups, activated (a follow within 14 days), active on the last 7 days, morning briefs sent and opened.',
  })
  @ApiOkResponse({ description: 'The four figures.' })
  getPlayersMonth(@Query() query: PlayersMonthQueryDto): Promise<PlayersMonth> {
    return this.players.getMonth(query.month);
  }

  @Get('players/accounts')
  @ApiOperation({
    summary: 'Joueurs › Comptes',
    description: 'Newest first, by first name or e-mail, 30 a page.',
  })
  @ApiOkResponse({ description: 'The accounts.' })
  getAccounts(
    @Query() query: PlayersAccountsQueryDto,
  ): Promise<{ items: PlayerAccount[]; page: number; more: boolean }> {
    return this.players.getAccounts(query);
  }

  @Get('players/:id')
  @ApiOperation({
    summary: "A player's sheet: account, followed coupons, thread",
  })
  @ApiOkResponse({ description: 'The sheet.' })
  getPlayer(@Param('id', ParseUUIDPipe) id: string): Promise<PlayerSheet> {
    return this.players.getPlayer(id);
  }
}
