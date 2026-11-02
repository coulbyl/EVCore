import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CouponRepository } from './coupon.repository';
import { CouponFollowRepository } from './coupon-follow.repository';
import {
  TODAY_PRODUCT_TARGETS,
  isTodayCoupon,
} from '@modules/screens/today-products';
import { formatDateUtc } from '@utils/date.utils';
import {
  classForTargetOddsMin,
  ABSTENTION_PASS_CLASS,
  ABSTENTION_PASS_TARGET,
} from './coupon.constants';
import type { CouponClassTrackRecord } from './dto/coupon-track-record.dto';
import type { CouponSource } from '@evcore/db';

// generateCoupons/generateForClass (CouponComposerService's glouton
// deterministic composer) retired 2026-09-03 — coupon composition is now
// apps/vantage-worker's LLM pipeline (pool-query.ts → score-candidates.ts →
// compose-coupon-class.ts → persist-coupon-proposal.ts), which writes
// CouponProposal/CouponProposalLeg directly via @evcore/db, never through
// this service. CouponPoolService (whose only caller was generateCoupons)
// retired alongside it — see docs/vantage-centric-redesign-2026-09-01.md
// §9bis. CouponService now only reads.
@Injectable()
export class CouponService {
  constructor(
    private readonly repo: CouponRepository,
    private readonly follows: CouponFollowRepository,
  ) {}

  /**
   * Produits du jour qui se sont abstenus, avec leur raison (2026-10-29) :
   * le joueur lit « Pas de Coupon cote 2 aujourd'hui : … » au lieu d'un
   * texte fixe. Un produit qui a quand même un coupon publié ce jour-là
   * (le combiné de l'IA, ou un passage antérieur qui avait composé) n'est
   * jamais dit absent.
   */
  async getAbstentions(
    date: string,
  ): Promise<{ couponClass: string; reason: string | null }[]> {
    const day = new Date(`${date}T00:00:00.000Z`);
    const [attempts, targets] = await Promise.all([
      this.repo.findLatestAttempts(day),
      this.repo.findPublishedTargets(day),
    ]);
    const published = new Set<string | null>(
      targets.map((target) => classForTargetOddsMin(target)),
    );
    return attempts.flatMap((attempt) => {
      const couponClass = ABSTENTION_PASS_CLASS[attempt.pass];
      return couponClass &&
        attempt.outcome === 'abstained' &&
        !published.has(couponClass)
        ? [{ couponClass, reason: attempt.reason }]
        : [];
    });
  }

  /**
   * Les produits déterministes qui se sont abstenus, jour par jour sur
   * [from, to[, avec la raison du moteur (2026-10-30). Aujourd'hui les lit
   * pour un jour, Résultats sur sa période. Contrairement à
   * `getAbstentions`, le combiné de l'IA ne masque pas l'abstention du
   * Combiné : il n'est pas un produit de ces écrans.
   */
  async getProductAbstentions(input: {
    from: Date;
    to: Date;
  }): Promise<{ date: string; product: string; reason: string | null }[]> {
    const rows = await this.repo.findAbstentionsBetween({
      ...input,
      passes: Object.entries(ABSTENTION_PASS_TARGET).map(
        ([pass, targetOddsMin]) => ({ pass, targetOddsMin }),
      ),
    });
    return rows.flatMap((row) => {
      const product = ABSTENTION_PASS_CLASS[row.pass];
      return product
        ? [{ date: formatDateUtc(row.forDate), product, reason: row.reason }]
        : [];
    });
  }

  /**
   * « Suivre ce coupon » (2026-10-28) : suivre sans déclarer de mise, pour
   * recevoir le résultat dans le résumé du matin. Idempotent dans les deux
   * sens.
   *
   * Seulement avant le premier coup d'envoi (04 § 3, 2026-10-30), dans les
   * deux sens aussi : suivre un coupon commencé, ou cesser de suivre celui
   * qui perd, ferait mentir le bilan de Moi.
   */
  async follow(
    couponProposalId: string,
    userId: string,
    now: Date = new Date(),
  ): Promise<void> {
    const coupon = await this.assertNotStarted(couponProposalId, now);
    // Seulement les coupons d'Aujourd'hui (2026-10-31) : Moi, son bilan et
    // les notifications lisent les mêmes coupons.
    if (
      !isTodayCoupon({
        source: coupon.source,
        rank: coupon.rank,
        targetOddsMin: Number(coupon.targetOddsMin),
      })
    ) {
      throw new BadRequestException('Ce coupon ne se suit pas.');
    }
    await this.follows.follow(couponProposalId, userId);
  }

  async unfollow(
    couponProposalId: string,
    userId: string,
    now: Date = new Date(),
  ): Promise<void> {
    await this.assertNotStarted(couponProposalId, now);
    await this.follows.unfollow(couponProposalId, userId);
  }

  /** « 7 coupons gagnés · 4 perdus · depuis le 13/10 » (09 § 1). */
  async getFollowedSummary(
    userId: string,
    range?: { from: Date; to: Date },
  ): Promise<{
    won: number;
    lost: number;
    refunded: number;
    since: string | null;
  }> {
    const summary = await this.follows.summaryFor({
      userId,
      targets: TODAY_PRODUCT_TARGETS,
      range,
    });
    return { ...summary, since: summary.since?.toISOString() ?? null };
  }

  private async assertNotStarted(couponProposalId: string, now: Date) {
    const coupon = await this.repo.findFirstKickoff(couponProposalId);
    if (!coupon) throw new NotFoundException('Coupon introuvable');
    if (coupon.firstKickoffAt && coupon.firstKickoffAt <= now) {
      throw new ConflictException(
        'Le premier match a commencé : ce coupon ne se suit plus.',
      );
    }
    return coupon;
  }

  /** Historique par produit sur une période fermée [from, to[ (relevé du lundi). */
  async getTrackRecordBetween(
    from: Date,
    to: Date,
  ): Promise<CouponClassTrackRecord[]> {
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    return this.trackRecordRows({ from, to, days });
  }

  private async trackRecordRows(window: {
    from: Date;
    to?: Date;
    days: number;
  }): Promise<CouponClassTrackRecord[]> {
    const { days } = window;
    const rows = await this.repo.findClassTrackRecord(window.from, window.to);
    return rows.map((row) => ({
      couponClass: classForTargetOddsMin(row.targetOddsMin),
      source: row.source as CouponSource,
      days,
      settled: row.settled,
      won: row.won,
      avgOdds: row.avgOdds,
      returnPerUnit: row.returnPerUnit,
      firstDay: isoDay(row.firstDay),
      lastDay: isoDay(row.lastDay),
      worstLosingStreak: row.worstLosingStreak,
    }));
  }
}

/** Colonne `@db.Date` lue par `$queryRaw` : minuit UTC, on garde AAAA-MM-JJ. */
function isoDay(day: Date): string {
  return day.toISOString().slice(0, 10);
}
