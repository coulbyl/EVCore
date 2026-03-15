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

  private resolveCode(competition: string): string {
    return competition.toUpperCase();
  }

  private async triggerGlobalSync(
    type: string,
    body: OddsLiveSyncBodyDto & OddsSnapshotRetentionBodyDto,
  ): Promise<void> {
    switch (this.resolveGlobalType(type)) {
      case 'fixtures':
        await this.etlService.triggerFixturesSync();
        return;
      case 'stats':
        await this.etlService.triggerStatsSync();
        return;
      case 'injuries':
        await this.etlService.triggerInjuriesSync();
        return;
      case 'settlement':
        await this.etlService.triggerPendingBetsSettlementSync();
        return;
      case 'odds-csv':
        await this.etlService.triggerOddsCsvImport();
        return;
      case 'odds-live':
        await this.etlService.triggerOddsLiveSync(body.date);
        return;
      case 'odds-retention':
        await this.etlService.triggerOddsSnapshotRetention(body.retentionDays);
        return;
    }
  }

  private async triggerLeagueSync(
    type: string,
    competitionCode: string,
  ): Promise<void> {
    switch (this.resolveLeagueType(type)) {
      case 'fixtures':
        await this.etlService.triggerFixturesSyncForLeague(competitionCode);
        return;
      case 'stats':
        await this.etlService.triggerStatsSyncForLeague(competitionCode);
        return;
      case 'injuries':
        await this.etlService.triggerInjuriesSyncForLeague(competitionCode);
        return;
    }
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
  return (
    type === 'fixtures' ||
    type === 'stats' ||
    type === 'injuries' ||
    type === 'settlement' ||
    type === 'odds-csv' ||
    type === 'odds-live' ||
    type === 'odds-retention'
  );
}

function isLeagueSyncType(type: string): type is LeagueSyncType {
  return type === 'fixtures' || type === 'stats' || type === 'injuries';
}
