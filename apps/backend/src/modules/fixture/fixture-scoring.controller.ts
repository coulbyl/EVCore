import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { parseIsoDate, startOfUtcDay } from '@utils/date.utils';
import { FixtureScoringService } from './fixture-scoring.service';
import { FixtureScoringQueryDto } from './dto/fixture-scoring-query.dto';
import { PausedGuard } from '@/common/guards/paused.guard';

@Controller('fixture')
@UseGuards(AuthSessionGuard)
export class FixtureScoringController {
  constructor(private readonly service: FixtureScoringService) {}

  @Get()
  getFixtures(@Query() query: FixtureScoringQueryDto) {
    const date = query.date
      ? parseIsoDate(query.date)
      : startOfUtcDay(new Date());

    return this.service.getFixtures(
      date,
      {
        status: query.status,
        competition: query.competition,
        timeSlot: query.timeSlot,
      },
      {
        cursor: query.cursor,
        limit: query.limit,
      },
    );
  }

  /** Fiche d'un match pour le joueur, ouverte depuis Décisions. */
  @Get(':id/sheet')
  @UseGuards(PausedGuard)
  async getFixtureSheet(@Param('id', ParseUUIDPipe) id: string) {
    const sheet = await this.service.getFixtureSheet(id);
    if (!sheet) throw new NotFoundException('Match introuvable');
    return sheet;
  }
}
