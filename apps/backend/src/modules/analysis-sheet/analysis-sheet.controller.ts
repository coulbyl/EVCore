import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { AnalysisSheetService } from './analysis-sheet.service';
import { AnalysisSheetQueryDto } from './dto/analysis-sheet-query.dto';

@ApiTags('analysis-sheet')
@UseGuards(AuthSessionGuard)
@Controller('analysis-sheet')
export class AnalysisSheetController {
  constructor(private readonly service: AnalysisSheetService) {}

  @Get()
  @ApiOperation({
    summary: 'Export the analysis sheet for a date range (txt or json)',
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

    return this.service.exportJson(input);
  }
}
