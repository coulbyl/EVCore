import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { EtlService } from './etl.service';
import { EtlErrorResponseDto } from './dto/etl-error-response.dto';
import { OddsPrematchSyncBodyDto } from './dto/odds-prematch-sync-body.dto';
import { OddsSnapshotRetentionBodyDto } from './dto/odds-snapshot-retention-body.dto';
import { AuthSessionGuard } from '../auth/auth-session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import type { AuthSession } from '../auth/auth.types';

type LeagueSyncType = 'fixtures' | 'stats' | 'injuries';
type GlobalSyncType =
  | LeagueSyncType
  | 'settlement'
  | 'stale-scheduled'
  | 'odds-csv'
  | 'elo'
  | 'odds-prematch'
  | 'analysis';

type SyncBody = OddsPrematchSyncBodyDto;
type RollingStatsSyncBody = { mode?: 'refresh' | 'rebuild' };
type GlobalSyncHandler = (service: EtlService, body: SyncBody) => Promise<void>;
type LeagueSyncHandler = (
  service: EtlService,
  competitionCode: string,
) => Promise<void>;

const GLOBAL_SYNC_HANDLERS: Record<GlobalSyncType, GlobalSyncHandler> = {
  fixtures: (service) => service.triggerFixturesSync(),
  stats: (service) => service.triggerStatsSync(),
  injuries: (service) => service.triggerInjuriesSync(),
  settlement: (service) => service.triggerPendingBetsSettlementSync(),
  'stale-scheduled': (service) => service.triggerStaleScheduledSync(),
  'odds-csv': (service) => service.triggerOddsCsvImport(),
  elo: (service) => service.triggerEloSync(),
  'odds-prematch': (service, body) =>
    service.triggerOddsPrematchSync(body.date),
  analysis: (service, body) => service.triggerBettingEngineAnalysis(body.date),
};

const LEAGUE_SYNC_HANDLERS: Record<LeagueSyncType, LeagueSyncHandler> = {
  fixtures: (service, competitionCode) =>
    service.triggerFixturesSyncForLeague(competitionCode),
  stats: (service, competitionCode) =>
    service.triggerStatsSyncForLeague(competitionCode),
  injuries: (service, competitionCode) =>
    service.triggerInjuriesSyncForLeague(competitionCode),
};

const GLOBAL_SYNC_TYPE_VALUES = [
  'fixtures',
  'stats',
  'injuries',
  'settlement',
  'stale-scheduled',
  'odds-csv',
  'elo',
  'odds-prematch',
  'analysis',
] as const satisfies readonly GlobalSyncType[];

const LEAGUE_SYNC_TYPE_VALUES = [
  'fixtures',
  'stats',
  'injuries',
] as const satisfies readonly LeagueSyncType[];

@ApiTags('ETL')
@Controller('etl')
export class EtlController {
  constructor(private readonly etlService: EtlService) {}

  private async ok(trigger: () => Promise<void>) {
    await trigger();
    return { status: 'ok' as const };
  }

  private async okForLeague(
    competition: string,
    trigger: (competitionCode: string) => Promise<void>,
  ) {
    const code = this.resolveCode(competition);
    await trigger(code);
    return { status: 'ok' as const, competitionCode: code };
  }

  private assertAdmin(session: AuthSession): void {
    if (session.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  @Get('status')
  @ApiOperation({
    summary: 'Queue status',
    description:
      'Returns BullMQ job counts (active, waiting, completed, failed, delayed) ' +
      'for every ETL queue. Use this to monitor pipeline health.',
  })
  @ApiOkResponse({
    description: 'Job counts per queue.',
    schema: {
      example: {
        'league-sync': {
          active: 0,
          waiting: 0,
          completed: 48,
          failed: 0,
          delayed: 0,
        },
        'pending-bets-settlement-sync': {
          active: 0,
          waiting: 0,
          completed: 8,
          failed: 0,
          delayed: 0,
        },
        'stale-scheduled-sync': {
          active: 0,
          waiting: 0,
          completed: 3,
          failed: 0,
          delayed: 0,
        },
        'odds-csv-import': {
          active: 0,
          waiting: 0,
          completed: 3,
          failed: 0,
          delayed: 0,
        },
        'elo-sync': {
          active: 0,
          waiting: 0,
          completed: 1,
          failed: 0,
          delayed: 0,
        },
        'odds-prematch-sync': {
          active: 0,
          waiting: 0,
          completed: 5,
          failed: 0,
          delayed: 0,
        },
        'betting-engine': {
          active: 0,
          waiting: 0,
          completed: 5,
          failed: 0,
          delayed: 0,
        },
        'odds-snapshot-retention': {
          active: 0,
          waiting: 0,
          completed: 1,
          failed: 0,
          delayed: 0,
        },
        'odds-historical-import': {
          active: 0,
          waiting: 0,
          completed: 9,
          failed: 0,
          delayed: 0,
        },
      },
    },
  })
  getStatus() {
    return this.etlService.getQueueStatus();
  }

  // ─── Full sync ────────────────────────────────────────────────────────────

  @Post('sync/full')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger full ETL sync',
    description:
      'Enqueues the unified league-sync pipeline in sequence: fixtures → settlement → ' +
      'stats → injuries, then odds-csv → elo → odds-prematch → analysis. Routine fixtures/injuries ' +
      'runs target the current season; stats also targets the current season only. Settlement ' +
      'refreshes only fixtures with pending bets/coupons. Use for initial backfill ' +
      'or after a long downtime.',
  })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  async triggerFullSync() {
    return this.ok(() => this.etlService.triggerFullSync());
  }

  // ─── Granular triggers ────────────────────────────────────────────────────

  @Post('sync/rolling-stats/:competitionCode/:season')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger rolling-stats season run',
    description:
      'Runs rolling-stats manually for one competition season. Default mode is refresh ' +
      '(incremental/idempotent). Use `mode: "rebuild"` only for forced reconstruction.',
  })
  @ApiParam({
    name: 'competitionCode',
    description:
      'Competition code. Free-form on purpose because supported competitions can evolve over time.',
    example: 'PL',
  })
  @ApiParam({
    name: 'season',
    description: 'Season year.',
    example: '2024',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['refresh', 'rebuild'] },
      },
    },
    required: false,
  })
  @ApiBadRequestResponse({
    description: 'Invalid season year or rolling-stats mode.',
    type: EtlErrorResponseDto,
    schema: {
      oneOf: [
        {
          example: {
            message: 'season must be a valid year (e.g. 2021)',
            error: 'Bad Request',
            statusCode: 400,
          },
        },
        {
          example: {
            message: 'mode must be either "refresh" or "rebuild"',
            error: 'Bad Request',
            statusCode: 400,
          },
        },
      ],
    },
  })
  async triggerRollingStatsSeason(
    @Param('competitionCode') competitionCode: string,
    @Param('season') season: string,
    @Body() body: RollingStatsSyncBody = {},
  ) {
    const code = this.resolveCode(competitionCode);
    const year = Number.parseInt(season, 10);

    if (Number.isNaN(year) || year < 1900 || year > 2100) {
      throw new BadRequestException('season must be a valid year (e.g. 2021)');
    }

    const mode = body.mode ?? 'refresh';
    if (mode !== 'refresh' && mode !== 'rebuild') {
      throw new BadRequestException(
        'mode must be either "refresh" or "rebuild"',
      );
    }

    await this.etlService.triggerRollingStatsSeason(code, year, mode);
    return { status: 'ok' as const, competitionCode: code, season: year, mode };
  }

  @Post('sync/fixtures/:competitionCode/backfill')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Backfill historical fixtures for specific seasons',
    description:
      'Enqueues fixtures sync jobs (syncScope=backfill) for each requested season year. ' +
      'Use before odds-csv backfill and backtest when a league has no historical data. ' +
      'Example: `?seasons=2022,2023,2024` imports 2022-23, 2023-24 and 2024-25.',
  })
  @ApiParam({
    name: 'competitionCode',
    description: 'Competition code (e.g. BL1, LL).',
    example: 'BL1',
  })
  @ApiBadRequestResponse({
    description: 'Missing or invalid seasons query parameter.',
    type: EtlErrorResponseDto,
  })
  async triggerFixturesBackfill(
    @Param('competitionCode') competitionCode: string,
    @Query('seasons') seasonsParam: string,
  ) {
    const code = this.resolveCode(competitionCode);
    const seasons = this.resolveSeasonYears(seasonsParam);
    await this.etlService.triggerFixturesBackfillForSeasons(code, seasons);
    return { status: 'ok' as const, competitionCode: code, seasons };
  }

  @Post('sync/stats/:competitionCode/backfill')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Backfill historical stats sync for specific seasons',
    description:
      'Enqueues stats sync jobs for each requested season year. Use this when a league ' +
      'has historical finished fixtures without xG, because routine stats sync only ' +
      'targets the current season. Example: `?seasons=2023,2024,2025`.',
  })
  @ApiParam({
    name: 'competitionCode',
    description: 'Competition code (e.g. J1, ERD, POR).',
    example: 'J1',
  })
  @ApiBadRequestResponse({
    description: 'Missing or invalid seasons query parameter.',
    type: EtlErrorResponseDto,
  })
  async triggerStatsBackfill(
    @Param('competitionCode') competitionCode: string,
    @Query('seasons') seasonsParam: string,
  ) {
    const code = this.resolveCode(competitionCode);
    const seasons = this.resolveSeasonYears(seasonsParam);
    await this.etlService.triggerStatsSyncForSeasons(code, seasons);
    return { status: 'ok' as const, competitionCode: code, seasons };
  }

  @Post('sync/odds-csv/:competitionCode/backfill')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Import historical CSV odds for specific seasons',
    description:
      'Imports Pinnacle/Bet365 closing odds from football-data.co.uk for the given ' +
      'competition and season start-years. Designed for backtest data population. ' +
      'Example: `?seasons=2022,2023,2024` imports seasons 2022-23, 2023-24 and 2024-25.',
  })
  @ApiParam({
    name: 'competitionCode',
    description: 'Competition code (e.g. PL, SA).',
    example: 'PL',
  })
  @ApiBadRequestResponse({
    description: 'Missing or invalid seasons query parameter.',
    type: EtlErrorResponseDto,
  })
  async triggerOddsCsvBackfill(
    @Param('competitionCode') competitionCode: string,
    @Query('seasons') seasonsParam: string,
  ) {
    const code = this.resolveCode(competitionCode);
    const seasons = this.resolveSeasonYears(seasonsParam);
    await this.etlService.triggerOddsCsvImportForSeasons(code, seasons);
    return { status: 'ok' as const, competitionCode: code, seasons };
  }

  @Post('sync/odds-historical/:competitionCode/backfill')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Import historical Pinnacle odds from The Odds API',
    description:
      'One-shot import of pre-match Pinnacle 1X2 odds for UCL, Europa or Conference League. ' +
      'Odds are tagged as HISTORICAL and never cleaned up by the retention worker. ' +
      'Example: `?seasons=2022,2023,2024` imports seasons 2022-23, 2023-24 and 2024-25.',
  })
  @ApiParam({
    name: 'competitionCode',
    description: 'UEFA competition code: UCL, UEL or UECL.',
    example: 'UCL',
  })
  @ApiBadRequestResponse({
    description: 'Missing or invalid seasons query parameter.',
    type: EtlErrorResponseDto,
  })
  async triggerOddsHistoricalImport(
    @Param('competitionCode') competitionCode: string,
    @Query('seasons') seasonsParam: string,
  ) {
    const code = this.resolveCode(competitionCode);
    const seasons = this.resolveSeasonYears(seasonsParam);
    await this.etlService.triggerOddsHistoricalImport(code, seasons);
    return { status: 'ok' as const, competitionCode: code, seasons };
  }

  @Post('sync/backtest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger all-seasons backtest run',
    description:
      'Runs the full backtest across all included seasons and refreshes the cached validation report.',
  })
  async triggerBacktest() {
    await this.etlService.triggerBacktestAllSeasons();
    return { status: 'ok' as const };
  }

  @Post('sync/backtest/:seasonId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger one-season backtest run',
    description:
      'Runs a targeted backtest for one seasonId. Useful for investigation without recalculating all seasons.',
  })
  async triggerBacktestSeason(@Param('seasonId') seasonId: string) {
    await this.etlService.triggerBacktestSeason(seasonId);
    return { status: 'ok' as const, seasonId };
  }

  @Post('sync/odds-retention')
  @UseGuards(AuthSessionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger odds snapshot retention cleanup',
    description:
      'Runs manual cleanup of old odds snapshots. Restricted to ADMIN users.',
  })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  async triggerOddsRetention(
    @CurrentSession() session: AuthSession,
    @Body() body: OddsSnapshotRetentionBodyDto = {},
  ) {
    this.assertAdmin(session);
    await this.etlService.triggerOddsSnapshotRetention(body.retentionDays);
    return { status: 'ok' as const };
  }

  @Post('sync/:type')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger ETL sync by type',
    description:
      'Triggers one ETL flow by type. Supported global types: fixtures, stats, injuries, ' +
      'settlement, stale-scheduled, odds-csv, elo, odds-prematch, analysis. For league-scoped runs, use ' +
      '`/etl/sync/:type/:competitionCode` with fixtures, stats, or injuries.',
  })
  @ApiParam({
    name: 'type',
    enum: GLOBAL_SYNC_TYPE_VALUES,
    description: 'Global ETL sync type.',
  })
  @ApiBody({
    schema: {
      oneOf: [{ type: 'object', properties: { date: { type: 'string' } } }],
    },
    required: false,
  })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  @ApiBadRequestResponse({
    description: 'Unsupported ETL sync type.',
    type: EtlErrorResponseDto,
    schema: {
      example: {
        message: 'Unsupported ETL sync type: unknown-job',
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  })
  async triggerSync(
    @Param('type') type: string,
    @Body() body: OddsPrematchSyncBodyDto = {},
  ) {
    return this.ok(() => this.triggerGlobalSync(type, body));
  }

  @Post('sync/:type/:competitionCode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger league-scoped ETL sync',
    description:
      'Triggers a league-scoped ETL flow for one competition code. Supported types: ' +
      'fixtures, stats, injuries. This path targets the current season for the league; ' +
      'use dedicated `/backfill` routes for explicit historical seasons.',
  })
  @ApiParam({
    name: 'type',
    enum: LEAGUE_SYNC_TYPE_VALUES,
    description: 'League-scoped ETL sync type.',
  })
  @ApiParam({
    name: 'competitionCode',
    description:
      'Competition code. Free-form on purpose because supported competitions can evolve over time.',
    example: 'PL',
  })
  @ApiBadRequestResponse({
    description:
      'Unsupported league-scoped ETL sync type. Only fixtures, stats and injuries are allowed here.',
    type: EtlErrorResponseDto,
    schema: {
      example: {
        message: 'Unsupported league-scoped ETL sync type: odds-csv',
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  })
  async triggerSyncForCompetition(
    @Param('type') type: string,
    @Param('competitionCode') competitionCode: string,
  ) {
    return this.okForLeague(competitionCode, (code) =>
      this.triggerLeagueSync(type, code),
    );
  }

  private resolveCode(competition: string): string {
    return competition.toUpperCase();
  }

  private resolveSeasonYears(seasonsParam: string | undefined): number[] {
    if (!seasonsParam?.trim()) {
      throw new BadRequestException(
        'seasons query param is required (e.g. ?seasons=2022,2023)',
      );
    }
    const years = seasonsParam
      .split(',')
      .map((s) => Number.parseInt(s.trim(), 10));
    if (years.some((y) => Number.isNaN(y) || y < 1900 || y > 2100)) {
      throw new BadRequestException(
        'seasons must be comma-separated valid years (e.g. ?seasons=2022,2023)',
      );
    }
    return years;
  }

  private async triggerGlobalSync(type: string, body: SyncBody): Promise<void> {
    const syncType = this.resolveGlobalType(type);
    await GLOBAL_SYNC_HANDLERS[syncType](this.etlService, body);
  }

  private async triggerLeagueSync(
    type: string,
    competitionCode: string,
  ): Promise<void> {
    const syncType = this.resolveLeagueType(type);
    await LEAGUE_SYNC_HANDLERS[syncType](this.etlService, competitionCode);
  }

  private resolveGlobalType(type: string): GlobalSyncType {
    if (isGlobalSyncType(type)) return type;
    throw new BadRequestException(`Unsupported ETL sync type: ${type}`);
  }

  private resolveLeagueType(type: string): LeagueSyncType {
    if (isLeagueSyncType(type)) return type;
    throw new BadRequestException(
      `Unsupported league-scoped ETL sync type: ${type}`,
    );
  }
}

function isGlobalSyncType(type: string): type is GlobalSyncType {
  return type in GLOBAL_SYNC_HANDLERS;
}

function isLeagueSyncType(type: string): type is LeagueSyncType {
  return type in LEAGUE_SYNC_HANDLERS;
}
