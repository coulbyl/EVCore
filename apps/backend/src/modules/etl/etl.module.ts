import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { BULLMQ_QUEUES } from '../../config/etl.constants';
import { FixtureModule } from '../fixture/fixture.module';
import { NotificationModule } from '../notification/notification.module';
import { EtlService } from './etl.service';
import { EtlController } from './etl.controller';
import { FixturesSyncWorker } from './workers/fixtures-sync.worker';
import { ResultsSyncWorker } from './workers/results-sync.worker';
import { OddsCsvImportWorker } from './workers/odds-csv-import.worker';
import { StatsSyncWorker } from './workers/stats-sync.worker';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue(
      { name: BULLMQ_QUEUES.FIXTURES_SYNC },
      { name: BULLMQ_QUEUES.RESULTS_SYNC },
      { name: BULLMQ_QUEUES.STATS_SYNC },
      { name: BULLMQ_QUEUES.ODDS_CSV_IMPORT },
    ),
    FixtureModule,
    NotificationModule,
  ],
  controllers: [EtlController],
  providers: [
    EtlService,
    FixturesSyncWorker,
    ResultsSyncWorker,
    StatsSyncWorker,
    OddsCsvImportWorker,
  ],
  exports: [EtlService],
})
export class EtlModule {}
