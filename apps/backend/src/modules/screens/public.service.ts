import { Injectable } from '@nestjs/common';
import { LAST_HERO_LOOKBACK_DAYS } from '@config/screens.constants';
import { formatDateUtc, startOfUtcDay } from '@utils/date.utils';
import { ResultsService } from './results.service';
import type { AiSummary, ProductSummary } from './results.types';
import { TodayService } from './today.service';
import type {
  TodayAbsence,
  TodayCoupon,
  TodayFormOutcome,
  TodayYesterdayItem,
} from './today.types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many product lines « Nos résultats » shows on the landing (11 § 1). */
const LANDING_RESULT_LINES = 3;

/** The hero card as a visitor sees it: no follow, no player state. */
export type PublicHero = Omit<TodayCoupon, 'followedByMe' | 'canFollow'>;

/** GET /public/today: the landing and the daily share image (11 § 1). */
export type PublicToday = {
  date: string;
  /** The coupon of the day, or null when nothing plays. */
  hero: PublicHero | null;
  /**
   * Without a hero today, the last one published within a week, settled or
   * not, and its day: a visitor sees the product, not an empty card.
   */
  lastHero: { date: string; coupon: PublicHero } | null;
  /** « 19 jours gagnés sur 24 · depuis le 13/10 »: its product over 30 days. */
  heroForm: {
    days: { date: string; outcome: TodayFormOutcome }[];
    won: number;
    played: number;
    since: string | null;
  } | null;
  /** « Hier », without anything a player follows. */
  yesterday: Omit<TodayYesterdayItem, 'followedByMe'>[];
  /** Why the products are absent today: « Rien à jouer · pourquoi ». */
  absences: TodayAbsence[];
  /** « Nos résultats »: the first lines of Résultats, since launch. */
  results: Pick<
    ProductSummary,
    | 'product'
    | 'won'
    | 'lost'
    | 'refunded'
    | 'tooEarly'
    | 'settledDays'
    | 'since'
  >[];
  ai: Pick<AiSummary, 'won' | 'lost' | 'tooEarly' | 'since'>;
};

/**
 * The public face (docs/refonte-ui/11 § 1): what a visitor may see without
 * an account. The hero only, never the legs of every product; the same
 * computation as the player's screens, without a player.
 */
@Injectable()
export class PublicService {
  constructor(
    private readonly today: TodayService,
    private readonly results: ResultsService,
  ) {}

  /** The most recent hero of the past week, newest day first. */
  private async lastHero(
    now: Date,
  ): Promise<{ date: string; coupon: TodayCoupon } | null> {
    for (let back = 1; back <= LAST_HERO_LOOKBACK_DAYS; back += 1) {
      const day = new Date(startOfUtcDay(now).getTime() - back * DAY_MS);
      const coupon = await this.today.heroOfDay(day, now);
      if (coupon) return { date: formatDateUtc(day), coupon };
    }
    return null;
  }

  async getToday(now: Date = new Date()): Promise<PublicToday> {
    const [screen, results] = await Promise.all([
      this.today.getToday(null, now),
      this.results.getResults({ period: 'all', isAdmin: false }, now),
    ]);
    const hero = screen.coupons.find((c) => c.id === screen.heroId) ?? null;
    const lastHero = hero ? null : await this.lastHero(now);
    const shown = hero ?? lastHero?.coupon;
    const form = shown
      ? screen.forms.find((f) => f.product === shown.product)
      : undefined;
    return {
      date: screen.date,
      hero: hero ? publicHero(hero) : null,
      lastHero: lastHero
        ? { date: lastHero.date, coupon: publicHero(lastHero.coupon) }
        : null,
      heroForm: form
        ? {
            days: form.days,
            won: form.won,
            played: form.played,
            since: form.days[0]?.date ?? null,
          }
        : null,
      yesterday: screen.yesterday.map(({ product, outcome }) => ({
        product,
        outcome,
      })),
      absences: screen.absences,
      results: results.products
        .slice(0, LANDING_RESULT_LINES)
        .map(
          ({ product, won, lost, refunded, tooEarly, settledDays, since }) => ({
            product,
            won,
            lost,
            refunded,
            tooEarly,
            settledDays,
            since,
          }),
        ),
      ai: {
        won: results.ai.won,
        lost: results.ai.lost,
        tooEarly: results.ai.tooEarly,
        since: results.ai.since,
      },
    };
  }
}

function publicHero(coupon: TodayCoupon): PublicHero {
  const { followedByMe: _followed, canFollow: _canFollow, ...hero } = coupon;
  return hero;
}
