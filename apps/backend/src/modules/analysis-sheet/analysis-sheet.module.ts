import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { AuthModule } from '@modules/auth/auth.module';
import { AnalysisSheetController } from './analysis-sheet.controller';
import { AnalysisSheetRepository } from './analysis-sheet.repository';
import { AnalysisSheetService } from './analysis-sheet.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AnalysisSheetController],
  providers: [AnalysisSheetRepository, AnalysisSheetService],
})
export class AnalysisSheetModule {}
