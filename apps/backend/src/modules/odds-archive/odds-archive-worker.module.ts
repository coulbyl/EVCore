import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ODDS_ARCHIVE } from '@config/odds-archive.constants';
import { StorageModule } from '@modules/storage/storage.module';
import { OddsArchiveModule } from './odds-archive.module';
import { OddsArchiveScheduler } from './odds-archive.scheduler';
import { OddsArchiveService } from './odds-archive.service';
import { OddsArchiveWorker } from './odds-archive.worker';

/** The nightly archive of `odds_snapshot` (worker process only). */
@Module({
  imports: [
    BullModule.registerQueue({ name: ODDS_ARCHIVE.QUEUE }),
    OddsArchiveModule,
    StorageModule,
  ],
  providers: [OddsArchiveService, OddsArchiveScheduler, OddsArchiveWorker],
})
export class OddsArchiveWorkerModule {}
