import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
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
import { AnalysisHorizonBodyDto } from './dto/analysis-horizon-body.dto';
import { BettingEngineRebuildBodyDto } from './dto/betting-engine-rebuild-body.dto';

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
  'stale-scheduled': (service, body) =>
    service.triggerStaleScheduledSync(body.lookbackDays),
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

  // ─── Rolling horizon ──────────────────────────────────────────────────────

  @Post('sync/analysis-horizon')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger rolling horizon analysis',
    description:
      'Enqueues odds-prematch-sync + betting-engine-analysis for a sliding window of ' +
      'upcoming days (default J+1..J+4). Each day is processed independently; ' +
      'J+1 is always re-run even if it was analyzed as J+2 the day before. ' +
      'This is the manual counterpart of the ETL_ENABLE_ROLLING_HORIZON cron.',
  })
  @ApiBody({ type: AnalysisHorizonBodyDto, required: false })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        enqueuedDates: ['2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06'],
      },
    },
  })
  async triggerAnalysisHorizon(@Body() body: AnalysisHorizonBodyDto = {}) {
    const result = await this.etlService.triggerRollingHorizonAnalysis(body);
    return { status: 'ok' as const, ...result };
  }

  // ─── Historical rebuild ───────────────────────────────────────────────────

  @Post('rebuild/betting-engine')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rebuild betting-engine analysis for all seasons',
    description:
      'Queues one idempotent rebuild job per season. Each job re-runs the betting ' +
      'engine on FINISHED fixtures that have no ModelRun yet, recreating ChannelDecision / ' +
      'ChannelSelection rows natively and settling bets. Safe to re-run: fixtures already ' +
      'analyzed are skipped (no duplicate runs). Use after a purge of analysis data. ' +
      'Pass an optional from/to (ISO YYYY-MM-DD) to restrict the scheduledAt window — ' +
      'useful to re-analyze a single matchweek without re-running whole seasons.',
  })
  @ApiBody({ type: BettingEngineRebuildBodyDto, required: false })
  @ApiOkResponse({
    schema: {
      example: { status: 'ok', queued: 42, seasonIds: ['season-id-1'] },
    },
  })
  async triggerBettingEngineRebuild(
    @Body() body: BettingEngineRebuildBodyDto = {},
  ) {
    const result = await this.etlService.triggerBettingEngineRebuild(body);
    return { status: 'ok' as const, ...result };
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
      'refreshes only fixtures with pending bets. Use for initial backfill ' +
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
      'One-shot import of pre-match Pinnacle odds for a single competition configured in ' +
      'THE_ODDS_API_SPORT_KEYS. Example: `?seasons=2022,2023,2024` imports seasons 2022-23, ' +
      '2023-24 and 2024-25. Use `sync/odds-historical/full` to backfill every configured ' +
      'competition in one call.',
  })
  @ApiParam({
    name: 'competitionCode',
    description:
      'Competition code configured in THE_ODDS_API_SPORT_KEYS (e.g. PL, UCL, ARG1).',
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

  @Post('sync/odds-historical/full')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Import historical Pinnacle odds from The Odds API across every configured league',
    description:
      'Bulk-triggers the odds-historical-import worker for every competition code in ' +
      'THE_ODDS_API_SPORT_KEYS, or a subset via `codes`, for the given seasons. Jobs are ' +
      'spaced out across the whole batch (not just per competition) to respect the provider ' +
      'rate limit. Example: `?seasons=2023,2024,2025` (all leagues) or ' +
      '`?seasons=2023,2024&codes=PL,SA,ARG1` (subset). ' +
      'Note: RUS1 is known to return a stale/frozen historical snapshot regardless of the ' +
      'requested date (see team-name-matching.ts investigation) — exclude it via `codes` ' +
      'unless that has been resolved with the provider.',
  })
  @ApiBadRequestResponse({
    description:
      'Missing/invalid seasons, or an unsupported competition code in `codes`.',
    type: EtlErrorResponseDto,
  })
  async triggerOddsHistoricalImportFull(
    @Query('seasons') seasonsParam: string,
    @Query('codes') codesParam?: string,
  ) {
    const seasons = this.resolveSeasonYears(seasonsParam);
    const codes = codesParam
      ?.split(',')
      .map((c) => this.resolveCode(c.trim()))
      .filter(Boolean);

    const competitionCodes =
      await this.etlService.triggerOddsHistoricalImportFull(seasons, codes);
    return { status: 'ok' as const, competitionCodes, seasons };
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
  @ApiBody({ type: OddsPrematchSyncBodyDto, required: false })
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

  // ─── Queue management ─────────────────────────────────────────────────────

  @Delete('queue/:name/failed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear failed jobs from a queue',
    description:
      'Removes all failed jobs from the given BullMQ queue. ' +
      'Returns the number of removed jobs.',
  })
  @ApiParam({ name: 'name', description: 'Queue name (e.g. league-sync)' })
  @ApiOkResponse({
    schema: { example: { status: 'ok', removed: 3 } },
  })
  async clearQueueFailed(@Param('name') name: string) {
    const removed = await this.etlService.cleanQueueFailed(name);
    return { status: 'ok' as const, removed };
  }

  @Get('schedulers')
  @ApiOperation({
    summary: 'List all registered job schedulers',
    description:
      'Returns all BullMQ job schedulers across every ETL queue, ' +
      'including the cron pattern and the next scheduled run timestamp (ms).',
  })
  @ApiOkResponse({
    schema: {
      example: [
        {
          queueName: 'betting-engine',
          key: 'cron:betting-engine-analysis',
          name: 'betting-engine-analysis',
          pattern: '*/15 * * * *',
          next: 1749600000000,
        },
      ],
    },
  })
  getSchedulers() {
    return this.etlService.getSchedulerStatus();
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
    const tokens = seasonsParam
      .trim()
      .split(',')
      .map((s) => s.trim());
    const years = tokens.map((s) => {
      if (!/^\d+$/.test(s)) return NaN;
      return Number.parseInt(s, 10);
    });

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
