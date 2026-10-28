import { Controller, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { AdminOrServiceTokenGuard } from '@modules/auth/admin-or-service-token.guard';
import { endOfUtcDay, parseIsoDate } from '@utils/date.utils';
import { ChannelDecisionService } from './channel-decision.service';
import { ChannelDecisionSettleRangeQueryDto } from './dto/channel-decision-settle-range-query.dto';

/**
 * Exploitation des décisions : réservé à l'admin ou au jeton de service.
 * Avant le 2026-10-28, n'importe quel joueur connecté pouvait relancer le
 * règlement.
 */
@Controller('channel-decisions')
@UseGuards(AdminOrServiceTokenGuard)
export class ChannelDecisionAdminController {
  constructor(private readonly channelDecisions: ChannelDecisionService) {}

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
}
