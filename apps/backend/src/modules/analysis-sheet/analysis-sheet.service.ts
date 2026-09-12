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
import {
  buildJsonSheetV2,
  type AnalysisSheetJsonV2,
} from './analysis-sheet-v2.render';
import {
  applyExportFilters,
  NO_EXPORT_FILTERS,
  type ExportFilters,
} from './analysis-sheet-v2.filters';
import { AnalysisSheetV2Service } from './analysis-sheet-v2.service';
import { LEG_POOL_DEFAULTS } from './leg-pool/leg-pool.builder';
import type { LegPoolFilters } from './analysis-sheet-v2.types';

export type AnalysisSheetInput = {
  from: string;
  to: string;
  competitionCode?: string;
  channel?: string;
};

/** Options propres à la v2 — toutes optionnelles, toutes avec un défaut sûr. */
export type AnalysisSheetV2Input = AnalysisSheetInput & {
  filters?: ExportFilters;
  compact?: boolean;
  includeContext?: boolean;
  includeCalibration?: boolean;
  includeLegPool?: boolean;
  legPool?: Partial<LegPoolFilters>;
};

@Injectable()
export class AnalysisSheetService {
  constructor(
    private readonly repository: AnalysisSheetRepository,
    private readonly v2: AnalysisSheetV2Service,
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

  /**
   * Fiche v2 : la v1 enrichie, jamais amputée.
   *
   * `context` est coupé au-delà de `maxContextRangeDays` plutôt que de tirer
   * l'historique de milliers d'équipes : la fiche reste servie, avec le motif
   * dans `contextReason`. Le cas d'usage visé est une plage de 1 à 3 jours.
   */
  async exportJsonV2(
    input: AnalysisSheetV2Input,
  ): Promise<AnalysisSheetJsonV2> {
    const range = this.dateRange(input);
    const { fixtures, meta } = await this.fetchFixtures(input);

    const filters = input.filters ?? NO_EXPORT_FILTERS;
    const filtered = applyExportFilters(fixtures, filters);

    const rangeDays = (range.to.getTime() - range.from.getTime()) / 86_400_000;
    const contextRequested = input.includeContext ?? true;
    const includeContext =
      contextRequested &&
      rangeDays <= ANALYSIS_SHEET_LIMITS.maxContextRangeDays;

    const legPoolFilters: LegPoolFilters = {
      ...LEG_POOL_DEFAULTS,
      ...input.legPool,
    };

    const built = await this.v2.build(filtered, {
      includeContext,
      includeCalibration: input.includeCalibration ?? true,
      includeLegPool: input.includeLegPool ?? true,
      legPoolFilters,
    });

    const sheet = buildJsonSheet(filtered, meta);

    return buildJsonSheetV2(sheet, {
      extrasByFixture: built.extrasByFixture,
      meta: built.meta,
      calibration: built.calibration,
      legPool: built.legPool,
      exportOptions: {
        statuses: filters.statuses,
        markets: filters.markets,
        excludeChannels: filters.excludeChannels,
        compact: input.compact ?? false,
        includeContext,
        includeCalibration: input.includeCalibration ?? true,
        includeLegPool: input.includeLegPool ?? true,
      },
    });
  }

  async exportTxt(input: AnalysisSheetInput): Promise<string> {
    const { fixtures, meta } = await this.fetchFixtures(input);
    return buildTxtSheet(fixtures, meta);
  }
}
