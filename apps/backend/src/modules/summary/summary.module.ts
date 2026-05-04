import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { SummaryController } from './summary.controller';
import { SummaryService } from './summary.service';
import { SummaryRepository } from './summary.repository';

@Module({
  imports: [AuthModule],
  controllers: [SummaryController],
  providers: [SummaryService, SummaryRepository],
})
export class SummaryModule {}
