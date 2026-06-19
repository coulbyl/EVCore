import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import {
  ChannelDecisionService,
  type ChannelDecisionChannelGroup,
  type ChannelDecisionItem,
  type ChannelDecisionMatchItem,
} from './channel-decision.service';
import { ChannelDecisionListQueryDto } from './dto/channel-decision-query.dto';

@Controller('channel-decisions')
@UseGuards(AuthSessionGuard)
export class ChannelDecisionController {
  constructor(private readonly channelDecisions: ChannelDecisionService) {}

  @Get()
  list(
    @Query() query: ChannelDecisionListQueryDto,
  ): Promise<ChannelDecisionItem[]> {
    return this.channelDecisions.list(this.toQuery(query));
  }

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
