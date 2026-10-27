import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { CouponSource } from '@evcore/db';
import type { CouponClassName } from '../coupon.constants';

export class CouponTrackRecordQueryDto {
  /** Fenêtre en jours, sur `forDate`. 30 par défaut. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(365)
  days?: number;
}

/**
 * Ce qu'un produit de coupon a réellement fait sur la fenêtre : jours
 * réglés, jours gagnés, et retour moyen d'une mise de 1. Une ligne par
 * classe (source + bande cible). Jamais un ROI mis en avant — à ces volumes
 * il n'a aucune puissance (CLAUDE.md) ; la fréquence de gain, elle, se lit.
 */
export type CouponClassTrackRecord = {
  couponClass: CouponClassName | null;
  source: CouponSource;
  days: number;
  settled: number;
  won: number;
  avgOdds: number;
  returnPerUnit: number;
  /**
   * Premier et dernier jour réglés de la classe dans la fenêtre (AAAA-MM-JJ).
   * Un relevé s'affiche toujours avec ses dates exactes : « 30 derniers
   * jours » sur sept jours réglés laissait croire à un mois complet.
   */
  firstDay: string;
  lastDay: string;
  /** Plus longue suite de coupons perdus d'affilée dans la fenêtre. */
  worstLosingStreak: number;
};
