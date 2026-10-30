import { BadRequestException, Injectable } from '@nestjs/common';
import { ME_SETTLED_PAGE_SIZE } from '@config/screens.constants';
import { SupportRepository } from '@modules/support/support.repository';
import type { AuthSessionUser } from '@modules/auth/auth.types';
import {
  MeRepository,
  type MeFollowedRow,
  type MeSettledCursor,
} from './me.repository';
import { TodayRepository } from './today.repository';
import { TODAY_PRODUCT_TARGETS } from './today-products';
import { couponsOf } from './today.service';
import type { MeScreen, MeSettledPage } from './me.types';
import type { TodayCoupon } from './today.types';

/** « <last kick-off epoch ms>.<coupon id> »: opaque to the client. */
export function encodeCursor(cursor: MeSettledCursor): string {
  return `${cursor.lastKickoffAt.getTime()}.${cursor.couponId}`;
}

export function decodeCursor(raw: string): MeSettledCursor {
  const match = /^(\d{1,15})\.([0-9a-f-]{36})$/.exec(raw);
  if (!match?.[1] || !match[2]) {
    throw new BadRequestException('Curseur invalide');
  }
  return { lastKickoffAt: new Date(Number(match[1])), couponId: match[2] };
}

/**
 * GET /me (09 § 1): the record of the followed coupons, those still running,
 * the last settled ones with a cursor for « Voir plus », the unread team
 * replies and the pause. Open during a pause (09 § 4). Five SQL queries:
 * the followed coupons, their legs, the record, and the two of the unread
 * count.
 */
@Injectable()
export class MeService {
  constructor(
    private readonly me: MeRepository,
    private readonly today: TodayRepository,
    private readonly support: SupportRepository,
  ) {}

  async getMe(
    user: AuthSessionUser,
    now: Date = new Date(),
  ): Promise<MeScreen> {
    const [followed, record, unreadReplies] = await Promise.all([
      this.followedCoupons({ userId: user.id, after: null, now }),
      this.me.findRecord({ userId: user.id, targets: TODAY_PRODUCT_TARGETS }),
      this.support.countUnreadForUser(user.id),
    ]);
    return {
      firstName: user.fullName,
      record: {
        won: record.won,
        lost: record.lost,
        refunded: record.refunded,
        since: record.since?.toISOString() ?? null,
      },
      inProgress: followed.inProgress,
      settled: followed.settled,
      unreadReplies,
      pausedUntil:
        user.pausedUntil && new Date(user.pausedUntil) > now
          ? user.pausedUntil
          : null,
    };
  }

  /** « Voir plus » under Réglés: the page after `cursor`. */
  async getSettled(input: {
    userId: string;
    cursor: string;
    now?: Date;
  }): Promise<MeSettledPage> {
    const { settled } = await this.followedCoupons({
      userId: input.userId,
      after: decodeCursor(input.cursor),
      now: input.now ?? new Date(),
    });
    return settled;
  }

  private async followedCoupons(input: {
    userId: string;
    after: MeSettledCursor | null;
    now: Date;
  }): Promise<{ inProgress: TodayCoupon[]; settled: MeSettledPage }> {
    // One more than the page: its presence says « Voir plus ».
    const rows = await this.me.findFollowed({
      userId: input.userId,
      targets: TODAY_PRODUCT_TARGETS,
      settledLimit: ME_SETTLED_PAGE_SIZE + 1,
      after: input.after,
      withInProgress: input.after === null,
    });
    const settledRows = rows.filter((row) => row.settled);
    const page = settledRows.slice(0, ME_SETTLED_PAGE_SIZE);
    const shown = [...rows.filter((row) => !row.settled), ...page];
    const legs = await this.today.findCouponLegsByIds({
      userId: input.userId,
      couponIds: shown.map((row) => row.couponId),
    });
    const byId = new Map(couponsOf(legs, input.now).map((c) => [c.id, c]));
    const couponsIn = (list: readonly MeFollowedRow[]): TodayCoupon[] =>
      list.flatMap((row) => {
        const coupon = byId.get(row.couponId);
        return coupon ? [coupon] : [];
      });
    const last = page.at(-1);
    return {
      inProgress: couponsIn(rows.filter((row) => !row.settled)).sort((a, b) =>
        a.firstKickoffAt.localeCompare(b.firstKickoffAt),
      ),
      settled: {
        coupons: couponsIn(page),
        nextCursor:
          settledRows.length > ME_SETTLED_PAGE_SIZE && last
            ? encodeCursor({
                lastKickoffAt: last.lastKickoffAt,
                couponId: last.couponId,
              })
            : null,
      },
    };
  }
}
