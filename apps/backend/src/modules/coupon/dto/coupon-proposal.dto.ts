import type { CouponClassName } from '../coupon.constants';
import type {
  CouponProposalStatus,
  CouponResult,
  CouponSource,
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
  /**
   * The exact ModelRun id captured when the leg was proposed — lets the
   * frontend submit this leg to
   * `POST /bet-slips` as a USER pick (`modelRunId` + `market` + `pick`,
   * resolved server-side against that run's `evaluatedPicks`), the same
   * mechanism `AddToSlipButton` (Matchs) already uses. `null` on the rare
   * fixture with no ModelRun at all (shouldn't happen for a leg VANTAGE's
   * pool itself was built from `evaluatedPicks`). Historical proposals without
   * captured provenance fall back to the fixture's latest run.
   */
  modelRunId: string | null;
};

export type CouponProposalDto = {
  id: string;
  forDate: string;
  rank: number;
  signalWindowDays: number;
  targetOddsMin: number;
  targetOddsMax: number;
  /**
   * Classe du coupon — SAFE / BALANCED / BOLD, une cible de cote combinée
   * chacune (voir COUPON_CLASSES). `null` pour les propositions historiques
   * générées avant les classes.
   */
  couponClass: CouponClassName | null;
  /**
   * Quel passage a produit initialement cette proposition — le batch du soir
   * (défaut, `VANTAGE_COUPON_CRON`) ou le batch intraday horaire
   * (`VANTAGE_COUPON_INTRADAY_CRON`, fenêtré sur les coups d'envoi proches).
   * La politique unifiée conserve une seule proposition immuable par jour ;
   * les passages suivants sont enregistrés dans CouponGenerationAttempt.
   */
  batch: 'evening' | 'intraday';
  /**
   * Quel générateur a produit la proposition.
   *
   * `LLM` — apps/vantage-worker, sélection par LLM.
   * `PRICE_COMPOSER` — compositeur déterministe qui classe sur le coût mesuré
   * du marché et n'utilise aucune probabilité du moteur.
   *
   * Les deux tournent en parallèle sur la même cible de cote : l'affichage doit
   * les distinguer, sinon on compare deux produits en croyant n'en voir qu'un.
   */
  source: CouponSource;
  combinedOdds: number;
  jointProbability: number;
  signalScore: number;
  status: CouponProposalStatus;
  /**
   * Real, verifiable engagement — never a fabricated social-proof number
   * (CLAUDE.md/docs/vantage-centric-redesign-2026-09-01.md §4 point 6).
   * `viewerCount`: distinct users who ever opened the Coupons page while
   * this proposal was showing (CouponProposalView, one row per user).
   * `playerCount`: distinct users who actually submitted a bet slip via
   * "Jouer ce coupon" (CouponProposalPlacement, recorded server-side inside
   * the bet slip's own creation transaction — never a client-side click
   * alone). `playedByMe`: whether the CURRENT user is one of them — freezes
   * "Jouer ce coupon" into "Déjà joué par vous".
   */
  viewerCount: number;
  playerCount: number;
  playedByMe: boolean;
  result: CouponResult | null;
  reasoning: Record<string, unknown> | null;
  lastFixtureScheduledAt: string;
  legs: CouponLegDto[];
  generatedAt: string;
};
