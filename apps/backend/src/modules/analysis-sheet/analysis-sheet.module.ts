import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { AuthModule } from '@modules/auth/auth.module';
import { AnalysisSheetController } from './analysis-sheet.controller';
import { AnalysisSheetRepository } from './analysis-sheet.repository';
import { AnalysisSheetRateLimitService } from './analysis-sheet.rate-limit.service';
import { AnalysisSheetService } from './analysis-sheet.service';
import { GroqLlmClient } from './groq/groq-llm.client';
import { LLM_CLIENT } from './groq/groq-llm.tokens';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AnalysisSheetController],
  providers: [
    AnalysisSheetRepository,
    AnalysisSheetRateLimitService,
    AnalysisSheetService,
    GroqLlmClient,
    { provide: LLM_CLIENT, useExisting: GroqLlmClient },
  ],
})
export class AnalysisSheetModule {}
