import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { endOfUtcDay, parseIsoDate } from '@utils/date.utils';
import {
  ChannelDecisionService,
  type ChannelDecisionChannelGroup,
  type ChannelDecisionMatchItem,
} from './channel-decision.service';
import { ChannelDecisionListQueryDto } from './dto/channel-decision-query.dto';
import { ChannelDecisionSettleRangeQueryDto } from './dto/channel-decision-settle-range-query.dto';

@Controller('channel-decisions')
@UseGuards(AuthSessionGuard)
export class ChannelDecisionController {
  constructor(private readonly channelDecisions: ChannelDecisionService) {}

  @Get('by-match')
  listByMatch(
    @Query() query: ChannelDecisionListQueryDto,
  ): Promise<ChannelDecisionMatchItem[]> {
    return this.channelDecisions.listByMatch(this.toQuery(query));
  }

  @Get('by-channel')
  listByChannel(
    @Query() query: ChannelDecisionListQueryDto,
  ): Promise<ChannelDecisionChannelGroup[]> {
    return this.channelDecisions.listByChannel(this.toQuery(query));
  }

  // Catch-up: force re-settlement of every ChannelSelection (the analytical
  // "won/lost" mirror) on every FINISHED fixture in [from, to]. Idempotent —
  // use after a settlement resolver bug fix or a post-hoc score correction.
  @Post('settle-range')
  @HttpCode(200)
  async settleRange(
    @Query() query: ChannelDecisionSettleRangeQueryDto,
  ): Promise<{ fixturesResettled: number; selectionsResettled: number }> {
    const from = parseIsoDate(query.from);
    const to = endOfUtcDay(parseIsoDate(query.to));
    return this.channelDecisions.settleRange(from, to);
  }

  private toQuery(query: ChannelDecisionListQueryDto) {
    const today = new Date().toISOString().slice(0, 10);
    return {
      date: query.date ?? today,
      competition: query.competition,
      channel: query.channel,
      market: query.market,
      status: query.status,
      phase: query.phase,
    };
  }
}
