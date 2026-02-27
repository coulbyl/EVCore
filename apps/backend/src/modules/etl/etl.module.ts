import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { BULLMQ_QUEUES } from '../../config/etl.constants';
import { FixtureModule } from '../fixture/fixture.module';
import { EtlService } from './etl.service';
import { EtlController } from './etl.controller';
import { FixturesSyncWorker } from './workers/fixtures-sync.worker';
import { ResultsSyncWorker } from './workers/results-sync.worker';
import { XgSyncWorker } from './workers/xg-sync.worker';
import { StatsSyncWorker } from './workers/stats-sync.worker';
import { OddsHistoricalSyncWorker } from './workers/odds-historical-sync.worker';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue(
      { name: BULLMQ_QUEUES.FIXTURES_SYNC },
      { name: BULLMQ_QUEUES.RESULTS_SYNC },
      { name: BULLMQ_QUEUES.XG_SYNC },
      { name: BULLMQ_QUEUES.STATS_SYNC },
      { name: BULLMQ_QUEUES.ODDS_HISTORICAL_SYNC },
    ),
    FixtureModule,
  ],
  controllers: [EtlController],
  providers: [
    EtlService,
    FixturesSyncWorker,
    ResultsSyncWorker,
    XgSyncWorker,
    StatsSyncWorker,
    OddsHistoricalSyncWorker,
  ],
  exports: [EtlService],
})
export class EtlModule {}
