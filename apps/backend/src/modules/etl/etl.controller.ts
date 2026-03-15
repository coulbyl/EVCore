import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EtlService } from './etl.service';
import { OddsLiveSyncBodyDto } from './dto/odds-live-sync-body.dto';
import { OddsSnapshotRetentionBodyDto } from './dto/odds-snapshot-retention-body.dto';

type LeagueSyncType = 'fixtures' | 'stats' | 'injuries';
type GlobalSyncType =
  | LeagueSyncType
  | 'settlement'
  | 'odds-csv'
  | 'odds-live'
  | 'odds-retention';

type SyncBody = OddsLiveSyncBodyDto & OddsSnapshotRetentionBodyDto;
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
  'odds-csv': (service) => service.triggerOddsCsvImport(),
  'odds-live': (service, body) => service.triggerOddsLiveSync(body.date),
  'odds-retention': (service, body) =>
    service.triggerOddsSnapshotRetention(body.retentionDays),
};

const LEAGUE_SYNC_HANDLERS: Record<LeagueSyncType, LeagueSyncHandler> = {
  fixtures: (service, competitionCode) =>
    service.triggerFixturesSyncForLeague(competitionCode),
  stats: (service, competitionCode) =>
    service.triggerStatsSyncForLeague(competitionCode),
  injuries: (service, competitionCode) =>
    service.triggerInjuriesSyncForLeague(competitionCode),
};

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
        'odds-csv-import': {
          active: 0,
          waiting: 0,
          completed: 3,
          failed: 0,
          delayed: 0,
        },
        'odds-live-sync': {
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
      'stats → injuries, then odds-csv and odds-live. Routine fixtures/injuries ' +
      'runs target the current season; stats still scans active seasons. Settlement ' +
      'refreshes only fixtures with pending bets/coupons. Use for initial backfill ' +
      'or after a long downtime.',
  })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  async triggerFullSync() {
    return this.ok(() => this.etlService.triggerFullSync());
  }

  // ─── Granular triggers ────────────────────────────────────────────────────

  @Post('sync/:type')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger ETL sync by type',
    description:
      'Triggers one ETL flow by type. Supported global types: fixtures, stats, injuries, ' +
      'settlement, odds-csv, odds-live, odds-retention. For league-scoped runs, use ' +
      '`/etl/sync/:type/:competitionCode` with fixtures, stats, or injuries.',
  })
  @ApiBody({
    schema: {
      oneOf: [
        { type: 'object', properties: { date: { type: 'string' } } },
        { type: 'object', properties: { retentionDays: { type: 'number' } } },
      ],
    },
    required: false,
  })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  async triggerSync(
    @Param('type') type: string,
    @Body() body: OddsLiveSyncBodyDto & OddsSnapshotRetentionBodyDto = {},
  ) {
    return this.ok(() => this.triggerGlobalSync(type, body));
  }

  @Post('sync/:type/:competitionCode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger league-scoped ETL sync',
    description:
      'Triggers a league-scoped ETL flow for one competition code. Supported types: ' +
      'fixtures, stats, injuries. Example competition codes: PL, SA, LL.',
  })
  async triggerSyncForCompetition(
    @Param('type') type: string,
    @Param('competitionCode') competitionCode: string,
  ) {
    return this.okForLeague(competitionCode, (code) =>
      this.triggerLeagueSync(type, code),
    );
  }

  @Post('sync/rolling-stats/:competitionCode/:season')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger rolling-stats season run',
    description:
      'Runs rolling-stats manually for one competition season. Default mode is refresh ' +
      '(incremental/idempotent). Use `mode: "rebuild"` only for forced reconstruction.',
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

  private resolveCode(competition: string): string {
    return competition.toUpperCase();
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
