import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import {
  ChannelDecisionService,
  type ChannelDecisionItem,
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
    const today = new Date().toISOString().slice(0, 10);
    return this.channelDecisions.list({
      date: query.date ?? today,
      competition: query.competition,
      channel: query.channel,
      market: query.market,
      status: query.status,
      phase: query.phase,
    });
  }
}
