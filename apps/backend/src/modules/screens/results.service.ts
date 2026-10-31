import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import {
  RESULTS_FIXED_STAKE,
  RESULTS_FORM_DAYS,
  RESULTS_PRODUCTS,
  RESULTS_RANGE_PATTERN,
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
  AiDetail,
  AiOpinion,
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

/**
 * The days a period counts: from its first day (null: since each launch,
 * « Tout ») to its last, both at UTC midnight and both counted.
 */
type Span = { from: Date | null; to: Date };

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
    const span = spanOf(input.period, today);
    const [days, abstentions, advice, week] = await Promise.all([
      this.productDays(products),
      this.abstentions(products, span),
      this.repository.findAiAdvice({
        since: aiSince(span),
        until: new Date(span.to.getTime() + DAY_MS - 1),
        asOf: now,
      }),
      // Monday: last week, in place of « Hier » (04 § 4, 08 § 1).
      now.getUTCDay() === 1
        ? this.productWeek.getWeek(previousIsoWeek(now))
        : Promise.resolve(null),
    ]);
    return {
      period: input.period,
      until: formatDateUtc(span.to),
      yesterday: yesterdayOf(products, days, today),
      week: week
        ? {
            week: week.week,
            products: week.products.flatMap(({ product, won, played }) =>
              isTodayProduct(product) ? [{ product, won, played }] : [],
            ),
          }
        : null,
      // A product launched after the player's last date has nothing to say.
      products: products
        .filter((product) => product.launchedOn <= formatDateUtc(span.to))
        .map((product) =>
          summaryOf({
            product,
            days: days.get(product.key) ?? [],
            abstentions: abstentions.get(product.key) ?? [],
            span,
          }),
        ),
      ai: aiSummaryOf(advice, span),
    };
  }

  /**
   * « Avis IA » opened (08 § 2): the same blocks with the opinion for unit,
   * and its opinions most recent first, the change of setting marked
   * rather than the older ones hidden.
   */
  async getAi(
    input: { period: ResultsPeriod },
    now: Date = new Date(),
  ): Promise<AiDetail> {
    const span = spanOf(input.period, startOfUtcDay(now));
    const advice = await this.repository.findAiAdvice({
      since: aiSince(span),
      until: new Date(span.to.getTime() + DAY_MS - 1),
      asOf: now,
    });
    return {
      ...aiSummaryOf(advice, span),
      opinions: opinionsOf(advice),
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
    const span = spanOf(input.period, startOfUtcDay(now));
    const [days, abstentions] = await Promise.all([
      this.productDays([product]),
      this.abstentions([product], span),
    ]);
    const productDays = days.get(product.key) ?? [];
    const productAbstentions = abstentions.get(product.key) ?? [];
    const summary = summaryOf({
      product,
      days: productDays,
      abstentions: productAbstentions,
      span,
    });
    return {
      ...summary,
      ...detailOf({
        since: summary.since,
        until: span.to,
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
    span: Span,
  ): Promise<Map<string, { date: string; reason: string | null }[]>> {
    const from = Math.min(
      ...products.map((p) => periodStart(p, span).getTime()),
    );
    const rows = await this.coupons.getProductAbstentions({
      from: new Date(from),
      to: new Date(span.to.getTime() + DAY_MS),
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

/**
 * The days a period counts. A preset ends today; the player's own dates
 * end on their last day, never after today, and a first day after the
 * last is refused.
 */
export function spanOf(period: ResultsPeriod, today: Date): Span {
  const range = RESULTS_RANGE_PATTERN.exec(period);
  if (range) {
    const from = new Date(`${range[1]}T00:00:00.000Z`);
    const last = new Date(`${range[2]}T00:00:00.000Z`);
    // « 2026-02-30 » would roll over to March: a date must read back the same.
    const real = (date: Date, text: string | undefined) =>
      !Number.isNaN(date.getTime()) && formatDateUtc(date) === text;
    if (!real(from, range[1]) || !real(last, range[2])) {
      throw new BadRequestException('Dates invalides');
    }
    const to = last < today ? last : today;
    if (from > to) throw new BadRequestException('Dates dans le désordre');
    return { from, to };
  }
  if (period === 'all') return { from: null, to: today };
  return {
    from: new Date(today.getTime() - (Number(period) - 1) * DAY_MS),
    to: today,
  };
}

/** The period's first day for a product: never before its launch. */
function periodStart(product: Pick<Product, 'launchedOn'>, span: Span): Date {
  const launch = new Date(`${product.launchedOn}T00:00:00.000Z`);
  if (span.from === null) return launch;
  return span.from > launch ? span.from : launch;
}

function aiSince(span: Span): Date {
  // « Tout » for the AI: its whole frozen history.
  return span.from ?? new Date('2020-01-01T00:00:00.000Z');
}

function summaryOf(input: {
  product: Product;
  days: readonly ProductDay[];
  abstentions: readonly { date: string }[];
  span: Span;
}): ProductSummary {
  const since = formatDateUtc(periodStart(input.product, input.span));
  const until = formatDateUtc(input.span.to);
  const upToEnd = input.days.filter((d) => d.date <= until);
  const inPeriod = upToEnd.filter((d) => d.date >= since);
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
    daysWithoutCoupon: input.abstentions.filter(
      (a) => a.date >= since && a.date <= until,
    ).length,
    worstLosingStreak: worstStreakOf(inPeriod.map((d) => d.outcome)),
    // The last ten played up to the period's end: today for a preset.
    last: lastPlayed(upToEnd.map((d) => d.outcome)),
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
  played: readonly {
    date: string;
    outcome: DayOutcome;
    chance: number | null;
  }[],
): ResultsComparison | null {
  const known = played.filter((d) => d.chance !== null);
  if (known.length === 0) return null;
  const dates = known.map((d) => d.date).sort();
  const announced = known
    .reduce((acc, d) => acc.plus(d.chance ?? 0), new Decimal(0))
    .div(known.length);
  return {
    days: known.length,
    from: dates[0] ?? null,
    to: dates.at(-1) ?? null,
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
  /** The period's last day, UTC midnight. */
  until: Date;
  days: readonly ProductDay[];
  abstentions: readonly { date: string; reason: string | null }[];
}): Pick<ProductDetail, 'grid' | 'days'> {
  const byDate = new Map(input.days.map((d) => [d.date, d]));
  const reasons = new Map(input.abstentions.map((a) => [a.date, a.reason]));
  const grid: ProductDetail['grid'] = [];
  const list: ResultsDay[] = [];
  for (
    let at = new Date(`${input.since}T00:00:00.000Z`);
    at <= input.until;
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
/**
 * The opinions, most recent first (the rows come in that order). An
 * opinion whose setting differs from the one before it in time marks the
 * change.
 */
export function opinionsOf(rows: readonly AiAdviceRow[]): AiOpinion[] {
  return rows.map((row, index) => {
    const older = rows[index + 1];
    return {
      date: formatDateUtc(row.kickoff),
      label: `${row.homeName} – ${row.awayName}`,
      market: row.market,
      pick: row.pick,
      odds: new Decimal(row.odds.toString()).toDecimalPlaces(3).toNumber(),
      outcome:
        row.result === 'WON'
          ? 'won'
          : row.result === 'LOST'
            ? 'lost'
            : 'refunded',
      settingChanged:
        older !== undefined &&
        row.configVersion !== null &&
        older.configVersion !== null &&
        row.configVersion !== older.configVersion,
    };
  });
}

function aiSummaryOf(rows: readonly AiAdviceRow[], span: Span): AiSummary {
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
      span.from === null
        ? chronological[0]
          ? formatDateUtc(chronological[0].kickoff)
          : null
        : formatDateUtc(span.from),
    won: played.filter((r) => r.result === 'WON').length,
    lost: played.filter((r) => r.result === 'LOST').length,
    refunded: chronological.length - played.length,
    last: lastPlayed(played.map((r) => outcome(r))),
    tooEarly,
    comparison: tooEarly ? null : comparisonOf(asDays),
    francs: tooEarly ? null : francsOf(asDays),
  };
}
