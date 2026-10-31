import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PausedGuard } from '@/common/guards/paused.guard';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { MatchesQueryDto } from './dto/matches-query.dto';
import { MatchSheetService } from './match-sheet.service';
import type { MatchSheet } from './match-sheet.types';
import { MatchesService } from './matches.service';
import type { MatchesScreen } from './matches.types';

/**
 * « Matchs ». Its readings are suggestions: the pause closes it like
 * « Aujourd'hui » (04 § 5), at class level.
 */
@ApiTags('screens')
@Controller('matches')
@UseGuards(AuthSessionGuard, PausedGuard)
export class MatchesController {
  constructor(
    private readonly matches: MatchesService,
    private readonly sheets: MatchSheetService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'One page of the day’s matches with their one reading',
    description:
      'Yesterday, today or tomorrow, by kick-off then the big competitions; each match carries its best reading (1xBet price, chance) and the ≠ sign when the AI picked otherwise, or why it has none. Keyset paging with `cursor`.',
  })
  @ApiOkResponse({ description: 'A page of the screen.' })
  getMatches(@Query() query: MatchesQueryDto): Promise<MatchesScreen> {
    return this.matches.getMatches({
      day: query.day ?? 'today',
      search: query.q,
      cursor: query.cursor,
    });
  }

  @Get(':id/sheet')
  @ApiOperation({
    summary: "The player's match sheet",
    description:
      'Our reading with its fact, the AI’s pick as one more pick, the form of both teams, the head-to-head line, the other main lines at 1xBet with the market frequency, and 1xBet’s margin on the match.',
  })
  @ApiOkResponse({ description: 'The sheet.' })
  getSheet(@Param('id', ParseUUIDPipe) id: string): Promise<MatchSheet> {
    return this.sheets.getSheet(id);
  }
}
