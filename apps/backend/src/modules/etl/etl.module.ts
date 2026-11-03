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
import { ApiFootballClient } from './api-football.client';
import { StatsBackfillService } from './stats-backfill.service';
import { SquadsSyncService } from './squads-sync.service';
import { CouponModule } from '../coupon/coupon.module';
import { AdjustmentModule } from '../adjustment/adjustment.module';
import { AuthModule } from '../auth/auth.module';
import { FixtureStatisticsModule } from '../fixture-statistics/fixture-statistics.module';
import { FixtureEventsModule } from '../fixture-events/fixture-events.module';

/**
 * The ETL as the API sees it: the queues it puts jobs on, the services the
 * admin's relaunches call. Its consumers and schedules live in
 * EtlWorkerModule, loaded by the worker process only.
 */
@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue(
      { name: BULLMQ_QUEUES.LEAGUE_SYNC },
      { name: BULLMQ_QUEUES.PENDING_BETS_SETTLEMENT },
      { name: BULLMQ_QUEUES.STALE_SCHEDULED_SYNC },
      { name: BULLMQ_QUEUES.ODDS_CSV_IMPORT },
      { name: BULLMQ_QUEUES.ELO_SYNC },
      { name: BULLMQ_QUEUES.COACH_SYNC },
      { name: BULLMQ_QUEUES.ODDS_PREMATCH_SYNC },
      { name: BULLMQ_QUEUES.BETTING_ENGINE },
      { name: BULLMQ_QUEUES.BETTING_ENGINE_REBUILD },
      { name: BULLMQ_QUEUES.SAME_DAY_ANALYSIS },
      { name: BULLMQ_QUEUES.ODDS_HISTORICAL_IMPORT },
      { name: BULLMQ_QUEUES.ROLLING_HORIZON },
      { name: BULLMQ_QUEUES.SEASON_ROLLOVER_SYNC },
      { name: BULLMQ_QUEUES.STATS_BACKFILL },
    ),
    BullModule.registerFlowProducer({ name: 'rolling-horizon-flow' }),
    AuthModule,
    AdjustmentModule,
    CouponModule,
    BettingEngineModule,
    FixtureModule,
    FixtureStatisticsModule,
    FixtureEventsModule,
    NotificationModule,
    RollingStatsModule,
  ],
  controllers: [EtlController],
  providers: [
    EtlService,
    ApiFootballClient,
    StatsBackfillService,
    SquadsSyncService,
  ],
  // The queues too: the worker module's processors consume them.
  exports: [
    EtlService,
    ApiFootballClient,
    StatsBackfillService,
    SquadsSyncService,
    BullModule,
  ],
})
export class EtlModule {}
