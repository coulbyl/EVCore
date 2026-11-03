import { Module } from '@nestjs/common';
import { AdjustmentModule } from '../adjustment/adjustment.module';
import { BettingEngineModule } from '../betting-engine/betting-engine.module';
import { CouponModule } from '../coupon/coupon.module';
import { FixtureModule } from '../fixture/fixture.module';
import { FixtureStatisticsModule } from '../fixture-statistics/fixture-statistics.module';
import { FixtureEventsModule } from '../fixture-events/fixture-events.module';
import { NotificationModule } from '../notification/notification.module';
import { RiskModule } from '../risk/risk.module';
import { RollingStatsModule } from '../rolling-stats/rolling-stats.module';
import { EtlModule } from './etl.module';
import { EtlScheduler } from './etl.scheduler';
import { LeagueSyncWorker } from './workers/league-sync.worker';
import { FixturesSyncWorker } from './workers/fixtures-sync.worker';
import { PendingBetsSettlementWorker } from './workers/pending-bets-settlement.worker';
import { OddsCsvImportWorker } from './workers/odds-csv-import.worker';
import { StatsSyncWorker } from './workers/stats-sync.worker';
import { OddsPrematchSyncWorker } from './workers/odds-prematch-sync.worker';
import { InjuriesSyncWorker } from './workers/injuries-sync.worker';
import { EloSyncWorker } from './workers/elo-sync.worker';
import { CoachSyncWorker } from './workers/coachs-sync.worker';
import { StaleScheduledSyncWorker } from './workers/stale-scheduled-sync.worker';
import { OddsHistoricalImportWorker } from './workers/odds-historical-import.worker';
import { BettingEngineAnalysisWorker } from './workers/betting-engine-analysis.worker';
import { BettingEngineRebuildWorker } from './workers/betting-engine-rebuild.worker';
import { SameDayAnalysisWorker } from './workers/same-day-analysis.worker';
import { RollingHorizonWorker } from './workers/rolling-horizon.worker';
import { SeasonRolloverSyncWorker } from './workers/season-rollover-sync.worker';
import { StatsBackfillWorker } from './workers/stats-backfill.worker';
/**
 * The ETL's consumers and recurring passes, in the worker process only
 * (main.worker.ts): a pass that runs the engine over every fixture no
 * longer holds the event loop that serves the players' screens.
 */
@Module({
  imports: [
    EtlModule,
    AdjustmentModule,
    BettingEngineModule,
    CouponModule,
    FixtureModule,
    FixtureStatisticsModule,
    FixtureEventsModule,
    NotificationModule,
    // The daily market sweep of PendingBetsSettlementWorker.
    RiskModule,
    RollingStatsModule,
  ],
  providers: [
    EtlScheduler,
    LeagueSyncWorker,
    FixturesSyncWorker,
    PendingBetsSettlementWorker,
    StaleScheduledSyncWorker,
    StatsSyncWorker,
    InjuriesSyncWorker,
    OddsCsvImportWorker,
    EloSyncWorker,
    CoachSyncWorker,
    OddsPrematchSyncWorker,
    BettingEngineAnalysisWorker,
    BettingEngineRebuildWorker,
    SameDayAnalysisWorker,
    OddsHistoricalImportWorker,
    RollingHorizonWorker,
    SeasonRolloverSyncWorker,
    StatsBackfillWorker,
  ],
})
export class EtlWorkerModule {}
