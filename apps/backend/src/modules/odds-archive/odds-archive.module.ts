import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { OddsArchiveRepository } from './odds-archive.repository';

/** The archive's reads, for the console (API process). */
@Module({
  imports: [PrismaModule],
  providers: [OddsArchiveRepository],
  exports: [OddsArchiveRepository],
})
export class OddsArchiveModule {}
