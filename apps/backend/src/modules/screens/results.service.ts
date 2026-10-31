import { Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import {
  RESULTS_FIXED_STAKE,
  RESULTS_FORM_DAYS,
  RESULTS_PRODUCTS,
  RESULTS_TOO_EARLY_DAYS,
} from '@config/results.constants';
import { CouponService } from '@modules/coupon/coupon.service';
import { ProductWeekService } from '@modules/coupon/product-day/product-week.service';
import { isTodayProduct } from './today-products';
import {
  formatDateUtc,
  previousIsoWeek,
  startOfUtcDay,
} from '@utils/date.utils';
import { ProductDayRepository } from '@modules/coupon/product-day/product-day.repository';
import { ResultsRepository, type AiAdviceRow } from './results.repository';
import type {
  ResultsYesterday,
  AiSummary,
  DayOutcome,
  ProductDetail,
  ProductSummary,
  ResultsComparison,
  ResultsDay,
  ResultsFrancs,
  ResultsPeriod,
  ResultsProductKey,
  ResultsScreen,
} from './results.types';

const DAY_MS = 24 * 60 * 60 * 1000;

type Product = (typeof RESULTS_PRODUCTS)[number];

/** A product's coupon of one day, reduced to what « Résultats » counts. */
type ProductDay = {
  date: string;
  couponId: string;
  outcome: DayOutcome;
  /** Chance shown for the coupon; null when unknown. */
  chance: number | null;
  /** 1xBet odds really paid on a won day; null otherwise or unknown. */
  paidOdds: Decimal | null;
  /** Every leg has its 1xBet price: the day can enter the francs. */
  priced: boolean;
  label: string;
  market: string | null;
  pick: string | null;
};

/**
 * « Résultats » (docs/refonte-ui/08): what each product gave, dated and
 * counted, losses included, against what was announced. It reads the
 * product_day aggregate written at settlement, never the coupons (16 § 3),
 * the abstentions, and the AI's settled opinions.
 */
@Injectable()
export class ResultsService {
  // eslint-disable-next-line max-params -- NestJS constructor injection: the AI, the product days, the abstentions, the week
  constructor(
    private readonly repository: ResultsRepository,
    private readonly productDayRows: ProductDayRepository,
    private readonly coupons: CouponService,
    private readonly productWeek: ProductWeekService,
  ) {}

  async getResults(
    input: { period: ResultsPeriod; isAdmin: boolean },
    now: Date = new Date(),
  ): Promise<ResultsScreen> {
    const products = RESULTS_PRODUCTS.filter(
      (p) => input.isAdmin || !p.retired,
    );
    const today = startOfUtcDay(now);
    const [days, abstentions, advice, week] = await Promise.all([
      this.productDays(products),
      this.abstentions(products, today, input.period),
      this.repository.findAiAdvice({
        since: aiSince(input.period, today),
        until: new Date(today.getTime() + DAY_MS - 1),
        asOf: now,
      }),
      // Monday: last week, in place of « Hier » (04 § 4, 08 § 1).
      now.getUTCDay() === 1
        ? this.productWeek.getWeek(previousIsoWeek(now))
        : Promise.resolve(null),
    ]);
    return {
      period: input.period,
      yesterday: yesterdayOf(products, days, today),
      week: week
        ? {
            week: week.week,
            products: week.products.flatMap(({ product, won, played }) =>
              isTodayProduct(product) ? [{ product, won, played }] : [],
            ),
          }
        : null,
      products: products.map((product) =>
        summaryOf({
          product,
          days: days.get(product.key) ?? [],
          abstentions: abstentions.get(product.key) ?? [],
          period: input.period,
          today,
        }),
      ),
      ai: aiSummaryOf(advice, input.period, today),
    };
  }

  async getProduct(
    input: { product: string; period: ResultsPeriod; isAdmin: boolean },
    now: Date = new Date(),
  ): Promise<ProductDetail> {
    const product = RESULTS_PRODUCTS.find(
      (p) => p.key === input.product && (input.isAdmin || !p.retired),
    );
    if (!product) throw new NotFoundException('Produit inconnu');
    const today = startOfUtcDay(now);
    const [days, abstentions] = await Promise.all([
      this.productDays([product]),
      this.abstentions([product], today, input.period),
    ]);
    const productDays = days.get(product.key) ?? [];
    const productAbstentions = abstentions.get(product.key) ?? [];
    const summary = summaryOf({
      product,
      days: productDays,
      abstentions: productAbstentions,
      period: input.period,
      today,
    });
    return {
      ...summary,
      ...detailOf({
        since: summary.since,
        today,
        days: productDays,
        abstentions: productAbstentions,
      }),
    };
  }

  /** Every stored day of these products since the first launch. */
  private async productDays(
    products: readonly Product[],
  ): Promise<Map<ResultsProductKey, ProductDay[]>> {
    const rows = await this.productDayRows.findDays({
      since: new Date(firstLaunch(products)),
      products: products.map((p) => p.key),
    });
    const byProduct = new Map<ResultsProductKey, ProductDay[]>();
    for (const row of rows) {
      const product = products.find((p) => p.key === row.product);
      if (!product) continue;
      const list = byProduct.get(product.key) ?? [];
      list.push({
        date: formatDateUtc(row.forDate),
        couponId: row.couponProposalId,
        outcome: row.outcome,
        chance: row.chance === null ? null : Number(row.chance),
        paidOdds:
          row.paidOdds === null ? null : new Decimal(row.paidOdds.toString()),
        priced: row.priced,
        label: row.label,
        market: row.market,
        pick: row.pick,
      });
      byProduct.set(product.key, list);
    }
    return byProduct;
  }

  /** Abstention days of the period, by product (the AI's are not recorded). */
  private async abstentions(
    products: readonly Product[],
    today: Date,
    period: ResultsPeriod,
  ): Promise<Map<string, { date: string; reason: string | null }[]>> {
    const from = Math.min(
      ...products.map((p) => periodStart(p, period, today).getTime()),
    );
    const rows = await this.coupons.getProductAbstentions({
      from: new Date(from),
      to: new Date(today.getTime() + DAY_MS),
    });
    const byProduct = new Map<
      string,
      { date: string; reason: string | null }[]
    >();
    for (const row of rows) {
      const list = byProduct.get(row.product) ?? [];
      list.push({ date: row.date, reason: row.reason });
      byProduct.set(row.product, list);
    }
    return byProduct;
  }
}

/**
 * Yesterday's coupon of each product of « Aujourd'hui », in screen order
 * (the AI combo and the retired products stay off the line).
 */
function yesterdayOf(
  products: readonly Product[],
  days: Map<ResultsProductKey, ProductDay[]>,
  today: Date,
): ResultsYesterday {
  const date = formatDateUtc(new Date(today.getTime() - DAY_MS));
  return {
    date,
    items: products.flatMap((product) => {
      if (!isTodayProduct(product.key)) return [];
      const day = days.get(product.key)?.find((d) => d.date === date);
      if (!day) return [];
      return [
        {
          product: product.key,
          outcome: day.outcome,
          paidOdds:
            day.outcome === 'won' && day.paidOdds
              ? day.paidOdds.toDecimalPlaces(3).toNumber()
              : null,
        },
      ];
    }),
  };
}

function firstLaunch(products: readonly Product[]): string {
  return (
    products.map((p) => p.launchedOn).sort()[0] ?? formatDateUtc(new Date())
  );
}

/** The period's first day for a product: never before its launch. */
function periodStart(
  product: Pick<Product, 'launchedOn'>,
  period: ResultsPeriod,
  today: Date,
): Date {
  const launch = new Date(`${product.launchedOn}T00:00:00.000Z`);
  if (period === 'all') return launch;
  const start = new Date(today.getTime() - (Number(period) - 1) * DAY_MS);
  return start > launch ? start : launch;
}

function aiSince(period: ResultsPeriod, today: Date): Date {
  // « Tout » for the AI: its whole frozen history.
  if (period === 'all') return new Date('2020-01-01T00:00:00.000Z');
  return new Date(today.getTime() - (Number(period) - 1) * DAY_MS);
}

function summaryOf(input: {
  product: Product;
  days: readonly ProductDay[];
  abstentions: readonly { date: string }[];
  period: ResultsPeriod;
  today: Date;
}): ProductSummary {
  const since = formatDateUtc(
    periodStart(input.product, input.period, input.today),
  );
  const inPeriod = input.days.filter((d) => d.date >= since);
  const played = inPeriod.filter(
    (d) => d.outcome === 'won' || d.outcome === 'lost',
  );
  const settledDays = input.days.filter((d) => d.outcome !== 'pending').length;
  const tooEarly = settledDays < RESULTS_TOO_EARLY_DAYS;
  return {
    product: input.product.key,
    retired: input.product.retired,
    launchedOn: input.product.launchedOn,
    since,
    won: played.filter((d) => d.outcome === 'won').length,
    lost: played.filter((d) => d.outcome === 'lost').length,
    refunded: inPeriod.filter((d) => d.outcome === 'refunded').length,
    daysWithoutCoupon: input.abstentions.filter((a) => a.date >= since).length,
    worstLosingStreak: worstStreakOf(inPeriod.map((d) => d.outcome)),
    last: lastPlayed(input.days.map((d) => d.outcome)),
    tooEarly,
    settledDays,
    comparison: tooEarly ? null : comparisonOf(played),
    francs: tooEarly ? null : francsOf(played),
  };
}

/** Lost days in a row; refunded and pending days neither break nor extend. */
function worstStreakOf(outcomes: readonly string[]): number {
  let streak = 0;
  let worst = 0;
  for (const outcome of outcomes) {
    if (outcome === 'won') streak = 0;
    if (outcome === 'lost') worst = Math.max(worst, (streak += 1));
  }
  return worst;
}

function lastPlayed(outcomes: readonly string[]): ('won' | 'lost')[] {
  return outcomes
    .filter((o): o is 'won' | 'lost' => o === 'won' || o === 'lost')
    .slice(-RESULTS_FORM_DAYS);
}

function comparisonOf(
  played: readonly { outcome: DayOutcome; chance: number | null }[],
): ResultsComparison | null {
  const known = played.filter((d) => d.chance !== null);
  if (known.length === 0) return null;
  const announced = known
    .reduce((acc, d) => acc.plus(d.chance ?? 0), new Decimal(0))
    .div(known.length);
  return {
    days: known.length,
    announced: announced.toDecimalPlaces(4).toNumber(),
    realised: new Decimal(known.filter((d) => d.outcome === 'won').length)
      .div(known.length)
      .toDecimalPlaces(4)
      .toNumber(),
  };
}

/**
 * Staked and returned at RESULTS_FIXED_STAKE a day, in decimal.js, on the
 * played days priced at 1xBet on every leg, won or lost alike: keeping a
 * lost day without a price while dropping a won one would leave mostly
 * losses (measured on the first run: 3 lost days of 14, « rendu 0 F »).
 * The others are counted apart, never as zero. The count and the amounts
 * cover the same days.
 */
function francsOf(
  played: readonly {
    date: string;
    outcome: DayOutcome;
    paidOdds: Decimal | null;
    priced: boolean;
  }[],
): ResultsFrancs | null {
  const known = played.filter((d) => d.priced);
  const stake = new Decimal(RESULTS_FIXED_STAKE);
  const returned = known.reduce(
    (acc, d) =>
      d.outcome === 'won' && d.paidOdds
        ? acc.plus(stake.times(d.paidOdds))
        : acc,
    new Decimal(0),
  );
  return {
    days: known.length,
    staked: stake.times(known.length).toNumber(),
    returned: returned.toDecimalPlaces(0).toNumber(),
    unpricedDays: played.length - known.length,
    from: known[0]?.date ?? null,
    to: known.at(-1)?.date ?? null,
  };
}

/**
 * The detail grid (one cell per calendar day of the period, « · » for a
 * day without coupon) and « Jour par jour », most recent first, abstention
 * days with their reason.
 */
function detailOf(input: {
  since: string;
  today: Date;
  days: readonly ProductDay[];
  abstentions: readonly { date: string; reason: string | null }[];
}): Pick<ProductDetail, 'grid' | 'days'> {
  const byDate = new Map(input.days.map((d) => [d.date, d]));
  const reasons = new Map(input.abstentions.map((a) => [a.date, a.reason]));
  const grid: ProductDetail['grid'] = [];
  const list: ResultsDay[] = [];
  for (
    let at = new Date(`${input.since}T00:00:00.000Z`);
    at <= input.today;
    at = new Date(at.getTime() + DAY_MS)
  ) {
    const date = formatDateUtc(at);
    const day = byDate.get(date);
    grid.push({ date, outcome: day?.outcome ?? 'none' });
    if (day) {
      list.push({
        date,
        outcome: day.outcome,
        label: day.label,
        market: day.market,
        pick: day.pick,
        paidOdds: day.paidOdds?.toDecimalPlaces(2).toNumber() ?? null,
        couponId: day.couponId,
      });
    } else if (reasons.has(date)) {
      list.push({ date, outcome: 'none', reason: reasons.get(date) ?? null });
    }
  }
  return { grid, days: list.reverse() };
}

/**
 * « Avis IA »: per opinion, not per day, on the AI's frozen history. The
 * announced chance is the AI's own probability; the francs use the odds it
 * was settled at.
 */
function aiSummaryOf(
  rows: readonly AiAdviceRow[],
  period: ResultsPeriod,
  today: Date,
): AiSummary {
  const chronological = [...rows].reverse();
  const played = chronological.filter((r) => r.result !== 'VOID');
  const outcome = (r: AiAdviceRow): DayOutcome =>
    r.result === 'WON' ? 'won' : r.result === 'LOST' ? 'lost' : 'refunded';
  const tooEarly = chronological.length < RESULTS_TOO_EARLY_DAYS;
  const asDays = played.map((r) => ({
    date: formatDateUtc(r.kickoff),
    outcome: outcome(r),
    chance: r.probability === null ? null : Number(r.probability),
    paidOdds: r.result === 'WON' ? new Decimal(r.odds.toString()) : null,
    // Every opinion is settled at the price it was recorded with.
    priced: true,
  }));
  return {
    since:
      period === 'all'
        ? chronological[0]
          ? formatDateUtc(chronological[0].kickoff)
          : null
        : formatDateUtc(aiSince(period, today)),
    won: played.filter((r) => r.result === 'WON').length,
    lost: played.filter((r) => r.result === 'LOST').length,
    refunded: chronological.length - played.length,
    last: lastPlayed(played.map((r) => outcome(r))),
    tooEarly,
    comparison: tooEarly ? null : comparisonOf(asDays),
    francs: tooEarly ? null : francsOf(asDays),
  };
}
