import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { AnalysisSheetService } from './analysis-sheet.service';
import { AnalysisSheetQueryDto } from './dto/analysis-sheet-query.dto';
import type { LegPoolFilters } from './analysis-sheet-v2.types';

@ApiTags('analysis-sheet')
@UseGuards(AuthSessionGuard)
@Controller('analysis-sheet')
export class AnalysisSheetController {
  constructor(private readonly service: AnalysisSheetService) {}

  @Get()
  @ApiOperation({
    summary:
      'Export the analysis sheet for a date range (txt or json, schema v1 or v2)',
  })
  async export(
    @Query() query: AnalysisSheetQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string | object> {
    const input = {
      from: query.from,
      to: query.to,
      competitionCode: query.competitionCode,
      channel: query.channel,
    };

    if (query.format === 'txt') {
      const content = await this.service.exportTxt(input);
      response.set({
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="fiche-evcore-${query.from}_${query.to}.txt"`,
      });
      return content;
    }

    // v1 reste le défaut : un appelant existant ne change pas de comportement
    // sans l'avoir demandé explicitement.
    if (query.schemaVersion !== '2') {
      return this.service.exportJson(input);
    }

    return this.service.exportJsonV2({
      ...input,
      filters: {
        statuses: query.status ?? null,
        markets: query.markets ?? null,
        excludeChannels: query.excludeChannels ?? null,
      },
      compact: query.compact,
      includeContext: query.includeContext,
      includeCalibration: query.includeCalibration,
      includeLegPool: query.includeLegPool,
      legPool: buildLegPoolOverrides(query),
    });
  }
}

/** Surcharges du legPool présentes dans la requête — les absentes gardent le défaut. */
function buildLegPoolOverrides(
  query: AnalysisSheetQueryDto,
): Partial<LegPoolFilters> {
  const overrides: Partial<LegPoolFilters> = {};
  if (query.legPoolMinOdds !== undefined) {
    overrides.minOdds = query.legPoolMinOdds;
  }
  if (query.legPoolMarkets !== undefined) {
    overrides.markets = query.legPoolMarkets as LegPoolFilters['markets'];
  }
  if (query.legPoolMinCoverage !== undefined) {
    overrides.minCoverage = query.legPoolMinCoverage;
  }
  if (query.legPoolExcludeFlags !== undefined) {
    overrides.excludeFlags = query.legPoolExcludeFlags;
  }
  if (query.legPoolStatus !== undefined) {
    overrides.status = query.legPoolStatus;
  }
  return overrides;
}
