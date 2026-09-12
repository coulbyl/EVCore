import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { AuthModule } from '@modules/auth/auth.module';
import { AnalysisSheetController } from './analysis-sheet.controller';
import { AnalysisSheetRepository } from './analysis-sheet.repository';
import { AnalysisSheetService } from './analysis-sheet.service';
import { AnalysisSheetV2Repository } from './analysis-sheet-v2.repository';
import { AnalysisSheetV2Service } from './analysis-sheet-v2.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AnalysisSheetController],
  providers: [
    AnalysisSheetRepository,
    AnalysisSheetService,
    AnalysisSheetV2Repository,
    AnalysisSheetV2Service,
  ],
})
export class AnalysisSheetModule {}
