import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { BULLMQ_QUEUES } from '../../config/etl.constants';
import { BettingEngineModule } from '../betting-engine/betting-engine.module';
import { BacktestModule } from '../backtest/backtest.module';
import { CouponModule } from '../coupon/coupon.module';
import { FixtureModule } from '../fixture/fixture.module';
import { NotificationModule } from '../notification/notification.module';
import { RollingStatsModule } from '../rolling-stats/rolling-stats.module';
import { EtlService } from './etl.service';
import { EtlController } from './etl.controller';
import { LeagueSyncWorker } from './workers/league-sync.worker';
import { FixturesSyncWorker } from './workers/fixtures-sync.worker';
import { PendingBetsSettlementWorker } from './workers/pending-bets-settlement.worker';
import { OddsCsvImportWorker } from './workers/odds-csv-import.worker';
import { StatsSyncWorker } from './workers/stats-sync.worker';
import { OddsPrematchSyncWorker } from './workers/odds-prematch-sync.worker';
import { InjuriesSyncWorker } from './workers/injuries-sync.worker';
import { OddsSnapshotRetentionWorker } from './workers/odds-snapshot-retention.worker';
import { EloSyncWorker } from './workers/elo-sync.worker';
import { StaleScheduledSyncWorker } from './workers/stale-scheduled-sync.worker';
import { AdjustmentModule } from '../adjustment/adjustment.module';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue(
      { name: BULLMQ_QUEUES.LEAGUE_SYNC },
      { name: BULLMQ_QUEUES.PENDING_BETS_SETTLEMENT },
      { name: BULLMQ_QUEUES.STALE_SCHEDULED_SYNC },
      { name: BULLMQ_QUEUES.ODDS_CSV_IMPORT },
      { name: BULLMQ_QUEUES.ELO_SYNC },
      { name: BULLMQ_QUEUES.ODDS_PREMATCH_SYNC },
      { name: BULLMQ_QUEUES.ODDS_SNAPSHOT_RETENTION },
    ),
    AdjustmentModule,
    BacktestModule,
    BettingEngineModule,
    CouponModule,
    FixtureModule,
    NotificationModule,
    RollingStatsModule,
  ],
  controllers: [EtlController],
  providers: [
    EtlService,
    LeagueSyncWorker,
    FixturesSyncWorker,
    PendingBetsSettlementWorker,
    StaleScheduledSyncWorker,
    StatsSyncWorker,
    InjuriesSyncWorker,
    OddsCsvImportWorker,
    EloSyncWorker,
    OddsPrematchSyncWorker,
    OddsSnapshotRetentionWorker,
  ],
  exports: [EtlService],
})
export class EtlModule {}
