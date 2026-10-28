import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import {
  ChannelDecisionService,
  type ChannelDecisionChannelGroup,
  type ChannelDecisionFacets,
  type ChannelDecisionMatchItem,
} from './channel-decision.service';
import {
  ChannelDecisionFacetsQueryDto,
  ChannelDecisionListQueryDto,
} from './dto/channel-decision-query.dto';
import { PausedGuard } from '@/common/guards/paused.guard';

// Tout ce contrôleur propose des paris : la pause s'applique à la classe,
// une route ajoutée plus tard ne peut pas l'oublier. Le rattrapage de
// règlement vit dans ChannelDecisionAdminController.
@Controller('channel-decisions')
@UseGuards(AuthSessionGuard, PausedGuard)
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

  // Facet drawer (§2bis) — leagues + channels present that day, with counts.
  // See ChannelDecisionRepository.findFacetRows.
  @Get('facets')
  getFacets(
    @Query() query: ChannelDecisionFacetsQueryDto,
  ): Promise<ChannelDecisionFacets> {
    const today = new Date().toISOString().slice(0, 10);
    return this.channelDecisions.getFacets(query.date ?? today);
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
