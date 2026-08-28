import { BadRequestException, Injectable } from '@nestjs/common';
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

export type AnalysisSheetInput = {
  from: string;
  to: string;
  competitionCode?: string;
  channel?: string;
};

@Injectable()
export class AnalysisSheetService {
  constructor(private readonly repository: AnalysisSheetRepository) {}

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
}
