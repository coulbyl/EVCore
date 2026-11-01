import { Global, Module } from '@nestjs/common';
import { AdminJournalRepository } from './admin-journal.repository';
import { AdminJournalService } from './admin-journal.service';

/** Global: every module with a human action writes to the one journal. */
@Global()
@Module({
  providers: [AdminJournalRepository, AdminJournalService],
  exports: [AdminJournalService],
})
export class AdminJournalModule {}
