import {
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
      'Enqueues the unified league-sync pipeline in sequence: fixtures → results → ' +
      'stats → injuries, then odds-csv and odds-live. Routine fixtures/results/injuries ' +
      'runs target the current season; stats still scans active seasons. Jobs are staggered ' +
      'to respect API rate limits. Use for initial backfill or after a long downtime.',
  })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  async triggerFullSync() {
    return this.ok(() => this.etlService.triggerFullSync());
  }

  // ─── Granular triggers ────────────────────────────────────────────────────

  @Post('sync/fixtures')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger fixtures sync',
    description:
      'Enqueues one league-sync fixtures job per active competition × current season. ' +
      'Fetches scheduled fixtures from API-Football and upserts them into the DB. ' +
      'Run this before results-sync or stats-sync to ensure fixture records exist.',
  })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  async triggerFixturesSync() {
    return this.ok(() => this.etlService.triggerFixturesSync());
  }

  @Post('sync/fixtures/:competition')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger fixtures sync for one league' })
  async triggerFixturesSyncForLeague(
    @Param('competition') competition: string,
  ) {
    return this.okForLeague(competition, (code) =>
      this.etlService.triggerFixturesSyncForLeague(code),
    );
  }

  @Post('sync/results')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger results sync',
    description:
      'Enqueues one league-sync results job per active competition × current season. ' +
      'Updates fixture statuses (FT, AET, PEN, AWD, POSTPONED) and final scores.',
  })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  async triggerResultsSync() {
    return this.ok(() => this.etlService.triggerResultsSync());
  }

  @Post('sync/results/:competition')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger results sync for one league' })
  async triggerResultsSyncForLeague(@Param('competition') competition: string) {
    return this.okForLeague(competition, (code) =>
      this.etlService.triggerResultsSyncForLeague(code),
    );
  }

  @Post('sync/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger stats sync',
    description:
      'Enqueues one league-sync stats job per active competition × active season. ' +
      'Fetches per-fixture statistics (xG, shots on target) for finished fixtures ' +
      'that have no xG data yet. Uses shots_on_target × 0.35 as a proxy when ' +
      'expected_goals is absent from the API response.',
  })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  async triggerStatsSync() {
    return this.ok(() => this.etlService.triggerStatsSync());
  }

  @Post('sync/stats/:competition')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger stats sync for one league' })
  async triggerStatsSyncForLeague(@Param('competition') competition: string) {
    return this.okForLeague(competition, (code) =>
      this.etlService.triggerStatsSyncForLeague(code),
    );
  }

  @Post('sync/injuries')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger injuries shadow sync',
    description:
      'Enqueues one league-sync injuries job per active competition × current season. ' +
      'Fetches injuries from API-Football for scheduled fixtures and stores ' +
      '`shadow_injuries` into the latest ModelRun.features per fixture.',
  })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  async triggerInjuriesSync() {
    return this.ok(() => this.etlService.triggerInjuriesSync());
  }

  @Post('sync/injuries/:competition')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger injuries sync for one league' })
  async triggerInjuriesSyncForLeague(
    @Param('competition') competition: string,
  ) {
    return this.okForLeague(competition, (code) =>
      this.etlService.triggerInjuriesSyncForLeague(code),
    );
  }

  @Post('sync/odds-csv')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger historical odds CSV import',
    description:
      'Enqueues one odds-csv-import job per active competition for the current ' +
      'CSV season only. Downloads Pinnacle + Bet365 ' +
      'closing odds from football-data.co.uk and upserts OddsSnapshot records. ' +
      'Rows with missing odds (0) are silently skipped.',
  })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  async triggerOddsCsvImport() {
    return this.ok(() => this.etlService.triggerOddsCsvImport());
  }

  @Post('sync/odds-live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger live odds snapshot',
    description:
      'Enqueues an odds-live-sync job that fetches pre-match odds from API-Football ' +
      'for every scheduled fixture on the target date. Bookmaker priority: Pinnacle → Bet365 ' +
      '(Match Winner market only). Fixtures without eligible odds are skipped without error. ' +
      'Omit the body to target tomorrow UTC (standard daily cron behaviour).',
  })
  @ApiBody({ type: OddsLiveSyncBodyDto, required: false })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  async triggerOddsLiveSync(@Body() body: OddsLiveSyncBodyDto = {}) {
    return this.ok(() => this.etlService.triggerOddsLiveSync(body.date));
  }

  @Post('sync/odds-retention')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger odds snapshot retention cleanup',
    description:
      'Enqueues an odds-snapshot-retention maintenance job that deletes ' +
      'OddsSnapshot rows older than the configured retention window. ' +
      'By default it uses ODDS_SNAPSHOT_RETENTION_DAYS, but you can override per run.',
  })
  @ApiBody({ type: OddsSnapshotRetentionBodyDto, required: false })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  async triggerOddsSnapshotRetention(
    @Body() body: OddsSnapshotRetentionBodyDto = {},
  ) {
    return this.ok(() =>
      this.etlService.triggerOddsSnapshotRetention(body.retentionDays),
    );
  }

  private resolveCode(competition: string): string {
    return competition.toUpperCase();
  }
}
