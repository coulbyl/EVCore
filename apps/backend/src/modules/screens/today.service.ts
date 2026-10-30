import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import {
  ENGINE_CHANCE_MAX_ODDS,
  TODAY_FOLLOWED_LOOKBACK_DAYS,
  TODAY_FORM_WINDOW_DAYS,
  TODAY_HERO_RELAY,
} from '@config/screens.constants';
import { CouponService } from '@modules/coupon/coupon.service';
import { formatDateUtc, startOfUtcDay } from '@utils/date.utils';
import {
  TodayRepository,
  type TodayFormRow,
  type TodayLegRow,
} from './today.repository';
import {
  TODAY_PRODUCT_TARGETS,
  isTodayProduct,
  productOfTarget,
  productRank,
} from './today-products';
import type {
  TodayAbsence,
  TodayCoupon,
  TodayCouponState,
  TodayFormOutcome,
  TodayLeg,
  TodayLegState,
  TodayProductForm,
  TodayProductKey,
  TodayScreen,
  TodayYesterdayItem,
} from './today.types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * GET /today: the « Aujourd'hui » screen in one answer
 * (docs/refonte-ui/04-aujourdhui-en-detail.md, 16 § 3). Three SQL queries:
 * the legs of today's and followed coupons, the product days of the form
 * window, today's abstentions.
 */
@Injectable()
export class TodayService {
  constructor(
    private readonly repository: TodayRepository,
    private readonly coupons: CouponService,
  ) {}

  async getToday(userId: string, now: Date = new Date()): Promise<TodayScreen> {
    const today = startOfUtcDay(now);
    const tomorrow = new Date(today.getTime() + DAY_MS);
    const [legRows, dayRows, abstentions] = await Promise.all([
      this.repository.findCouponLegs({
        userId,
        today,
        followedSince: new Date(
          today.getTime() - TODAY_FOLLOWED_LOOKBACK_DAYS * DAY_MS,
        ),
        targets: TODAY_PRODUCT_TARGETS,
      }),
      this.repository.findProductDays({
        userId,
        since: new Date(today.getTime() - TODAY_FORM_WINDOW_DAYS * DAY_MS),
        until: today,
        targets: TODAY_PRODUCT_TARGETS,
      }),
      this.coupons.getProductAbstentions({ from: today, to: tomorrow }),
    ]);

    const allCoupons = couponsOf(legRows, now);
    const todayKey = formatDateUtc(today);
    const coupons = allCoupons.filter((c) => c.forDate === todayKey);
    const yesterdayKey = formatDateUtc(new Date(today.getTime() - DAY_MS));

    return {
      date: todayKey,
      yesterday: yesterdayOf(dayRows, yesterdayKey),
      heroId: heroOf(coupons),
      coupons,
      absences: absencesOf(abstentions),
      followedInProgress: allCoupons.filter((c) => c.forDate !== todayKey),
      forms: formsOf(dayRows),
    };
  }
}

/** Groups leg rows into coupons, one per product and day, in screen order. */
function couponsOf(rows: readonly TodayLegRow[], now: Date): TodayCoupon[] {
  const byId = new Map<string, { first: TodayLegRow; legs: TodayLegRow[] }>();
  for (const row of rows) {
    const entry = byId.get(row.couponId);
    if (entry) entry.legs.push(row);
    else byId.set(row.couponId, { first: row, legs: [row] });
  }
  const seen = new Set<string>();
  const coupons: TodayCoupon[] = [];
  for (const { first, legs } of byId.values()) {
    const product = productOfTarget(Number(first.targetOddsMin));
    const forDate = formatDateUtc(first.forDate);
    // One coupon per product and day: a second source in the same band
    // would be a generator bug, never two cards.
    if (!product || seen.has(`${forDate}:${product}`)) continue;
    seen.add(`${forDate}:${product}`);
    coupons.push(couponOf({ product, forDate, first, legs, now }));
  }
  return coupons.sort(
    (a, b) =>
      a.forDate.localeCompare(b.forDate) ||
      productRank(a.product) - productRank(b.product),
  );
}

function couponOf(input: {
  product: TodayProductKey;
  forDate: string;
  first: TodayLegRow;
  legs: readonly TodayLegRow[];
  now: Date;
}): TodayCoupon {
  const { first, legs, now } = input;
  const firstKickoff = legs.reduce(
    (min, leg) => (leg.scheduledAt < min ? leg.scheduledAt : min),
    legs[0]?.scheduledAt ?? first.scheduledAt,
  );
  const state = couponState(first.result, firstKickoff, now);
  return {
    id: first.couponId,
    product: input.product,
    forDate: input.forDate,
    state,
    firstKickoffAt: firstKickoff.toISOString(),
    odds: operatorOddsOf(legs),
    referenceOdds: Number(first.combinedOdds),
    paidOdds:
      state === 'won' && first.realizedOdds !== null
        ? Number(first.realizedOdds)
        : null,
    chance: couponChanceOf(legs),
    followedByMe: first.followedByMe,
    canFollow: state === 'upcoming',
    legs: legs.map((leg) => legOf(leg, now)),
  };
}

function couponState(
  result: TodayLegRow['result'],
  firstKickoff: Date,
  now: Date,
): TodayCouponState {
  if (result === 'WON' || result === 'PARTIAL') return 'won';
  if (result === 'LOST') return 'lost';
  if (result === 'VOID') return 'void';
  return firstKickoff.getTime() <= now.getTime() ? 'live' : 'upcoming';
}

/**
 * The 1xBet price of the coupon: the product of its legs' prices, in
 * decimal.js. A leg without a 1xBet price makes the whole price unknown,
 * never borrowed from the reference odds (docs/review-expectations.md).
 */
function operatorOddsOf(legs: readonly TodayLegRow[]): number | null {
  let product = new Decimal(1);
  for (const leg of legs) {
    if (leg.operatorOdds === null) return null;
    product = product.times(leg.operatorOdds.toString());
  }
  return product.toDecimalPlaces(3).toNumber();
}

/**
 * A leg's chance (06 § 2): the engine's announced probability up to
 * ENGINE_CHANCE_MAX_ODDS, the market's frequency without margin above —
 * the engine is optimistic there. The odds compared are the ones shown
 * (1xBet's, else the reference). Above the threshold without a market
 * frequency, the chance is unknown: never the engine's in its place.
 */
function legChanceOf(row: TodayLegRow): Decimal | null {
  const odds = row.operatorOdds ?? row.oddsSnapshot;
  if (odds !== null && Number(odds) > ENGINE_CHANCE_MAX_ODDS) {
    return row.operatorFairProbability === null
      ? null
      : new Decimal(row.operatorFairProbability.toString());
  }
  return new Decimal(row.probability.toString());
}

/** Π of the legs' chances, in decimal.js; unknown if one is. */
function couponChanceOf(legs: readonly TodayLegRow[]): number | null {
  let chance = new Decimal(1);
  for (const leg of legs) {
    const legChance = legChanceOf(leg);
    if (legChance === null) return null;
    chance = chance.times(legChance);
  }
  return chance.toDecimalPlaces(4).toNumber();
}

function legOf(row: TodayLegRow, now: Date): TodayLeg {
  return {
    fixtureId: row.fixtureId,
    kickoffAt: row.scheduledAt.toISOString(),
    competition: { code: row.competitionCode, name: row.competitionName },
    home: {
      name: row.homeName,
      shortName: row.homeShortName,
      logoUrl: row.homeLogoUrl,
    },
    away: {
      name: row.awayName,
      shortName: row.awayShortName,
      logoUrl: row.awayLogoUrl,
    },
    market: row.market,
    pick: row.pick,
    line: row.line === null ? null : Number(row.line),
    odds: row.operatorOdds === null ? null : Number(row.operatorOdds),
    chance: legChanceOf(row)?.toNumber() ?? null,
    marketFrequency:
      row.operatorFairProbability === null
        ? null
        : Number(row.operatorFairProbability),
    // Empty means « nothing solid »: no sentence either way.
    fact: row.fact || null,
    state: legState(row, now),
    score:
      row.fixtureStatus === 'FINISHED' &&
      row.homeScore !== null &&
      row.awayScore !== null
        ? { home: row.homeScore, away: row.awayScore }
        : null,
  };
}

function legState(row: TodayLegRow, now: Date): TodayLegState {
  if (row.isCorrect === true) return 'won';
  if (row.isCorrect === false) return 'lost';
  if (row.settledAt !== null) return 'void';
  if (row.fixtureStatus === 'POSTPONED' || row.fixtureStatus === 'CANCELLED') {
    return 'postponed';
  }
  return row.scheduledAt.getTime() <= now.getTime() ? 'live' : 'upcoming';
}

function outcomeOf(result: TodayFormRow['result']): TodayFormOutcome | null {
  if (result === 'WON' || result === 'PARTIAL') return 'won';
  if (result === 'LOST') return 'lost';
  if (result === 'VOID') return 'void';
  return null;
}

/** One entry per product and day, the first row winning (as couponsOf). */
function productDays(
  rows: readonly TodayFormRow[],
): { product: TodayProductKey; date: string; row: TodayFormRow }[] {
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    const product = productOfTarget(Number(row.targetOddsMin));
    const date = formatDateUtc(row.forDate);
    if (!product || seen.has(`${date}:${product}`)) return [];
    seen.add(`${date}:${product}`);
    return [{ product, date, row }];
  });
}

/**
 * « Hier » (04 § 4): a word per product that played yesterday, the
 * followed ones first, then screen order; nothing for a product that did not
 * play.
 */
function yesterdayOf(
  rows: readonly TodayFormRow[],
  yesterday: string,
): TodayYesterdayItem[] {
  return productDays(rows)
    .filter((day) => day.date === yesterday)
    .map(
      ({ product, row }): TodayYesterdayItem => ({
        product,
        outcome: outcomeOf(row.result) ?? 'pending',
        followedByMe: row.followedByMe,
      }),
    )
    .sort(
      (a, b) =>
        Number(b.followedByMe) - Number(a.followedByMe) ||
        productRank(a.product) - productRank(b.product),
    );
}

/**
 * The form of each product over the window, settled days only. The worst
 * streak counts consecutive lost days; a refunded day neither breaks nor
 * extends it (same rule as CouponRepository.findClassTrackRecord).
 */
function formsOf(rows: readonly TodayFormRow[]): TodayProductForm[] {
  const forms = new Map<TodayProductKey, TodayProductForm>();
  for (const { product, date, row } of productDays(rows)) {
    const outcome = outcomeOf(row.result);
    if (!outcome) continue;
    const form = forms.get(product) ?? {
      product,
      days: [],
      won: 0,
      played: 0,
      worstLosingStreak: 0,
    };
    form.days.push({ date, outcome });
    forms.set(product, form);
  }
  return [...forms.values()]
    .map((form) => ({ ...form, ...countsOf(form.days) }))
    .sort((a, b) => productRank(a.product) - productRank(b.product));
}

function countsOf(days: TodayProductForm['days']): {
  won: number;
  played: number;
  worstLosingStreak: number;
} {
  let won = 0;
  let played = 0;
  let streak = 0;
  let worst = 0;
  for (const { outcome } of days) {
    if (outcome === 'void') continue;
    played += 1;
    if (outcome === 'won') {
      won += 1;
      streak = 0;
    } else {
      streak += 1;
      worst = Math.max(worst, streak);
    }
  }
  return { won, played, worstLosingStreak: worst };
}

/** The first product of the relay that has a coupon today. */
function heroOf(coupons: readonly TodayCoupon[]): string | null {
  for (const product of TODAY_HERO_RELAY) {
    const coupon = coupons.find((c) => c.product === product);
    if (coupon) return coupon.id;
  }
  return null;
}

/**
 * Products that abstained today, with the engine's reason, in screen
 * order. CouponService.getProductAbstentions already leaves out a product
 * that has a coupon of this screen, and the passes of other products.
 */
function absencesOf(
  abstentions: readonly { product: string; reason: string | null }[],
): TodayAbsence[] {
  return abstentions
    .flatMap(({ product, reason }) =>
      isTodayProduct(product) ? [{ product, reason }] : [],
    )
    .sort((a, b) => productRank(a.product) - productRank(b.product));
}
