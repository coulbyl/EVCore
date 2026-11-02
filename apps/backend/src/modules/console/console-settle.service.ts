import { BadRequestException, Injectable } from '@nestjs/common';
import { CONSOLE_SETTLE_MAX_DAYS } from '@config/console.constants';
import { AdminJournalService } from '@modules/admin-journal/admin-journal.service';
import { ChannelDecisionService } from '@modules/betting-engine/channel-decision.service';
import { CouponSettlementService } from '@modules/coupon/coupon-settlement.service';
import { endOfUtcDay, parseIsoDate } from '@utils/date.utils';
import { ConsoleRepository } from './console.repository';
import type { SettleKind, SettlePreview, SettleResult } from './console.types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many results differ between two readings of the same rows. */
export function changedCount(
  before: ReadonlyMap<string, string | null>,
  after: ReadonlyMap<string, string | null>,
): number {
  let changed = 0;
  for (const [id, result] of after) {
    if (before.get(id) !== result) changed += 1;
  }
  return changed;
}

/**
 * Exploitation › Régler de nouveau: replay the settlement of the coupons, or
 * of the engine's picks, over a range of dates. Idempotent: a result
 * already right stays; the count of the ones that changed is said and
 * journaled. Nothing is sent to the players.
 */
@Injectable()
export class ConsoleSettleService {
  // eslint-disable-next-line max-params -- NestJS constructor injection: both settlements, the console's reads, the journal
  constructor(
    private readonly coupons: CouponSettlementService,
    private readonly selections: ChannelDecisionService,
    private readonly repository: ConsoleRepository,
    private readonly journal: AdminJournalService,
  ) {}

  async preview(input: {
    kind: SettleKind;
    from: string;
    to: string;
  }): Promise<SettlePreview> {
    const span = spanOf(input);
    const [counts, last] = await Promise.all([
      input.kind === 'coupons'
        ? this.repository.settleCouponsPreview(span)
        : this.repository.settleSelectionsPreview(span),
      this.journal.latest('settlement_replayed'),
    ]);
    return {
      kind: input.kind,
      from: input.from,
      to: input.to,
      ...counts,
      last,
    };
  }

  async replay(input: {
    kind: SettleKind;
    from: string;
    to: string;
    actorId: string;
  }): Promise<SettleResult> {
    const span = spanOf(input);
    const read = () =>
      input.kind === 'coupons'
        ? this.repository.couponResults(span)
        : this.repository.selectionResults(span);
    const before = await read();
    if (input.kind === 'coupons') {
      await this.coupons.settleRange(span.from, span.to);
    } else {
      await this.selections.settleRange(span.from, span.to);
    }
    const after = await read();
    const result: SettleResult = {
      kind: input.kind,
      replayed: after.size,
      corrected: changedCount(before, after),
    };
    await this.journal.record({
      actorId: input.actorId,
      kind: 'settlement_replayed',
      target: `${input.kind} ${input.from} → ${input.to}`,
      after: result,
    });
    return result;
  }
}

function spanOf(input: { from: string; to: string }): { from: Date; to: Date } {
  const from = parseIsoDate(input.from);
  const to = endOfUtcDay(parseIsoDate(input.to));
  if (to.getTime() < from.getTime()) {
    throw new BadRequestException('La fin est avant le début');
  }
  if (to.getTime() - from.getTime() > CONSOLE_SETTLE_MAX_DAYS * DAY_MS) {
    throw new BadRequestException(
      `Pas plus de ${CONSOLE_SETTLE_MAX_DAYS} jours d'un coup`,
    );
  }
  return { from, to };
}
