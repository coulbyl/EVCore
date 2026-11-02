import {
  Controller,
  Delete,
  Post,
  Param,
  ParseUUIDPipe,
  Query,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
} from '@nestjs/swagger';
import { parseIsoDate, endOfUtcDay } from '@utils/date.utils';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { CouponService } from './coupon.service';
import { CouponSettlementService } from './coupon-settlement.service';
import { CouponSettleRangeQueryDto } from './dto/coupon-settle-range-query.dto';
import { PausedGuard } from '@/common/guards/paused.guard';
import { AdminOrServiceTokenGuard } from '@modules/auth/admin-or-service-token.guard';

@ApiTags('coupons')
@Controller('coupons')
export class CouponController {
  constructor(
    private readonly coupon: CouponService,
    private readonly settlement: CouponSettlementService,
  ) {}

  // « Suivre ce coupon » : propose de suivre un pari, donc fermé pendant
  // une pause ; arrêter de suivre reste toujours possible.
  @Post(':id/follow')
  @UseGuards(AuthSessionGuard, PausedGuard)
  @HttpCode(204)
  @ApiOperation({
    summary: 'Follow a coupon without staking (idempotent)',
    description: 'Refused (409) once the first match has kicked off.',
  })
  async follow(
    @CurrentSession() session: AuthSession,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.coupon.follow(id, session.user.id);
  }

  @Delete(':id/follow')
  @UseGuards(AuthSessionGuard)
  @HttpCode(204)
  @ApiOperation({
    summary: 'Stop following a coupon (idempotent)',
    description:
      'Refused (409) once the first match has kicked off: a losing coupon cannot be dropped from the record.',
  })
  async unfollow(
    @CurrentSession() session: AuthSession,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.coupon.unfollow(id, session.user.id);
  }

  @Post('settle-range')
  @HttpCode(200)
  // Déclenche une écriture sur toute la table : réservé à l'administration,
  // comme les autres relances d'ETL. Était ouvert sans session jusqu'au
  // 2026-10-08. Le jeton de service (x-admin-token) passe aussi, comme les
  // autres relances depuis le lot 2.
  @UseGuards(AdminOrServiceTokenGuard)
  @ApiOperation({
    summary: 'Force re-settlement of every proposal in a forDate range',
    description:
      'Re-runs settlement for all proposals (any status, including already-EXPIRED) ' +
      'whose forDate falls within [from, to]. Idempotent and safe to re-run — use as ' +
      'catch-up after a settlement bug fix, when you do not have individual proposal IDs.',
  })
  @ApiQuery({ name: 'from', required: true, example: '2026-07-01' })
  @ApiQuery({ name: 'to', required: true, example: '2026-07-15' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { resettled: { type: 'number', example: 12 } },
    },
  })
  async settleRange(
    @Query() query: CouponSettleRangeQueryDto,
  ): Promise<{ resettled: number }> {
    const from = parseIsoDate(query.from);
    const to = endOfUtcDay(parseIsoDate(query.to));
    return this.settlement.settleRange(from, to);
  }
}
