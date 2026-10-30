import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PausedGuard } from '@/common/guards/paused.guard';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { MatchesQueryDto } from './dto/matches-query.dto';
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
  constructor(private readonly matches: MatchesService) {}

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
}
