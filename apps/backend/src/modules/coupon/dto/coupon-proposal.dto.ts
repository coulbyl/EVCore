import type { CouponClassName } from '../coupon.constants';
import type {
  CouponProposalStatus,
  CouponResult,
  Market,
  StrategyChannel,
} from '@evcore/db';

export type CouponLegDto = {
  id: string;
  fixtureId: string;
  homeTeam: string;
  homeLogo: string | null;
  awayTeam: string;
  awayLogo: string | null;
  competition: string;
  competitionName: string;
  country: string;
  scheduledAt: string;
  score: string | null;
  htScore: string | null;
  canal: StrategyChannel;
  market: Market;
  pick: string;
  probability: number;
  oddsSnapshot: number | null;
  signalScore: number;
  isCorrect: boolean | null;
};

export type CouponProposalDto = {
  id: string;
  forDate: string;
  rank: number;
  signalWindowDays: number;
  targetOddsMin: number;
  targetOddsMax: number;
  /**
   * True for LONGSHOT_WEEKEND/MIDWEEK proposals (targetOddsMin at or above
   * that profile's floor) — no dedicated backtest exists yet for these
   * (composeGreedy has never run in prod), generated purely to observe real
   * settlement data. The frontend must always show these with a clearly
   * distinguishing badge, never as an unlabeled recommendation alongside
   * the backtested default profile.
   */
  experimental: boolean;
  /**
   * Classe du coupon — SAFE / BALANCED / BOLD, une cible de cote combinée
   * chacune (voir COUPON_CLASSES). `null` pour les propositions historiques
   * générées avant les classes.
   */
  couponClass: CouponClassName | null;
  combinedOdds: number;
  jointProbability: number;
  signalScore: number;
  status: CouponProposalStatus;
  result: CouponResult | null;
  reasoning: Record<string, unknown> | null;
  lastFixtureScheduledAt: string;
  legs: CouponLegDto[];
  generatedAt: string;
};
