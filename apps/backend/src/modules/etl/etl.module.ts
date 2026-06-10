import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { BULLMQ_QUEUES } from '../../config/etl.constants';
import { BettingEngineModule } from '../betting-engine/betting-engine.module';
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
import { EloSyncWorker } from './workers/elo-sync.worker';
import { StaleScheduledSyncWorker } from './workers/stale-scheduled-sync.worker';
import { OddsHistoricalImportWorker } from './workers/odds-historical-import.worker';
import { BettingEngineAnalysisWorker } from './workers/betting-engine-analysis.worker';
import { AiEngineCouponWorker } from './workers/ai-engine-coupon.worker';
import { StandingsSyncWorker } from './workers/standings-sync.worker';
import { RollingHorizonWorker } from './workers/rolling-horizon.worker';
import { AiEngineModule } from '../ai-engine/ai-engine.module';
import { AdjustmentModule } from '../adjustment/adjustment.module';
import { AuthModule } from '../auth/auth.module';

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
      { name: BULLMQ_QUEUES.BETTING_ENGINE },
      { name: BULLMQ_QUEUES.ODDS_HISTORICAL_IMPORT },
      { name: BULLMQ_QUEUES.AI_ENGINE },
      { name: BULLMQ_QUEUES.STANDINGS_SYNC },
      { name: BULLMQ_QUEUES.ROLLING_HORIZON },
      { name: BULLMQ_QUEUES.ML_TRAINING },
      { name: BULLMQ_QUEUES.ML_SCHEDULER },
    ),
    BullModule.registerFlowProducer({ name: 'rolling-horizon-flow' }),
    AuthModule,
    AdjustmentModule,
    AiEngineModule,
    BettingEngineModule,
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
    BettingEngineAnalysisWorker,
    AiEngineCouponWorker,
    OddsHistoricalImportWorker,
    StandingsSyncWorker,
    RollingHorizonWorker,
  ],
  exports: [EtlService],
})
export class EtlModule {}
