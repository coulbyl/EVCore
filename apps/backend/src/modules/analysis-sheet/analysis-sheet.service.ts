import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { endOfUtcDay, parseIsoDate, startOfUtcDay } from '@utils/date.utils';
import { ANALYSIS_SHEET_LIMITS } from './analysis-sheet.constants';
import {
  AnalysisSheetRepository,
  type AnalysisSheetFixture,
} from './analysis-sheet.repository';
import {
  buildJsonSheet,
  buildTxtSheet,
  type AnalysisSheetJson,
  type SheetMeta,
} from './analysis-sheet.render';
import {
  buildEvaAnalysisSystemPrompt,
  buildEvaAnalysisUserPrompt,
} from './analysis-sheet.prompt';
import { AnalysisSheetRateLimitService } from './analysis-sheet.rate-limit.service';
import { LLM_CLIENT } from './groq/groq-llm.tokens';
import type { LlmClient } from './groq/groq-llm.types';

export type AnalysisSheetInput = {
  from: string;
  to: string;
  competitionCode?: string;
  channel?: string;
};

export type AnalyzeWithEvaResult = {
  analysis: string;
  sheetSummary: AnalysisSheetJson['summary'];
  model: string;
  generatedAt: string;
  truncated: boolean;
};

@Injectable()
export class AnalysisSheetService {
  constructor(
    private readonly repository: AnalysisSheetRepository,
    private readonly rateLimit: AnalysisSheetRateLimitService,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
  ) {}

  private dateRange(input: { from: string; to: string }): {
    from: Date;
    to: Date;
  } {
    const from = startOfUtcDay(parseIsoDate(input.from));
    const to = endOfUtcDay(parseIsoDate(input.to));
    if (to < from) {
      throw new BadRequestException('"to" doit être postérieur à "from".');
    }
    const rangeDays = (to.getTime() - from.getTime()) / 86_400_000;
    if (rangeDays > ANALYSIS_SHEET_LIMITS.maxRangeDays) {
      throw new BadRequestException(
        `Plage de dates trop large (max ${ANALYSIS_SHEET_LIMITS.maxRangeDays} jours).`,
      );
    }
    return { from, to };
  }

  private async fetchFixtures(
    input: AnalysisSheetInput,
  ): Promise<{ fixtures: AnalysisSheetFixture[]; meta: SheetMeta }> {
    const range = this.dateRange(input);
    const fixtures = await this.repository.getFixturesInRange({
      range,
      competitionCode: input.competitionCode,
      channel: input.channel,
    });
    const meta: SheetMeta = {
      generatedAt: new Date().toISOString(),
      range: { from: input.from, to: input.to },
      filters: {
        competitionCode: input.competitionCode ?? null,
        channel: input.channel ?? null,
      },
    };
    return { fixtures, meta };
  }

  async exportJson(input: AnalysisSheetInput): Promise<AnalysisSheetJson> {
    const { fixtures, meta } = await this.fetchFixtures(input);
    return buildJsonSheet(fixtures, meta);
  }

  async exportTxt(input: AnalysisSheetInput): Promise<string> {
    const { fixtures, meta } = await this.fetchFixtures(input);
    return buildTxtSheet(fixtures, meta);
  }

  async assertDailyQuota(userId: string): Promise<void> {
    const requests = await this.rateLimit.getUsageRequests({
      userId,
      day: startOfUtcDay(new Date()),
    });
    if (requests >= ANALYSIS_SHEET_LIMITS.defaultDailyLimit) {
      throw new BadRequestException(
        'Limite quotidienne Eva atteinte. Réessayez demain.',
      );
    }
  }

  async analyzeWithEva(
    userId: string,
    input: AnalysisSheetInput,
  ): Promise<AnalyzeWithEvaResult> {
    await this.assertDailyQuota(userId);

    const { fixtures, meta } = await this.fetchFixtures(input);
    const truncated =
      fixtures.length > ANALYSIS_SHEET_LIMITS.maxFixturesForAnalysis;
    const analyzedFixtures = truncated
      ? fixtures.slice(0, ANALYSIS_SHEET_LIMITS.maxFixturesForAnalysis)
      : fixtures;

    let sheetText = buildTxtSheet(analyzedFixtures, meta);
    if (truncated) {
      const omitted = fixtures.length - analyzedFixtures.length;
      sheetText += `\n\n... ${omitted} fixtures supplémentaires non incluses (limite atteinte).`;
    }

    const response = await this.llm.complete({
      messages: [
        { role: 'system', content: buildEvaAnalysisSystemPrompt() },
        { role: 'user', content: buildEvaAnalysisUserPrompt(sheetText) },
      ],
    });

    await this.rateLimit.incrementUsage({
      userId,
      day: startOfUtcDay(new Date()),
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
    });

    return {
      analysis: response.content,
      sheetSummary: buildJsonSheet(analyzedFixtures, meta).summary,
      model: response.model,
      generatedAt: meta.generatedAt,
      truncated,
    };
  }
}
