import { Injectable } from '@nestjs/common';
import { RESULTS_PRODUCTS } from '@config/results.constants';
import { formatDateUtc } from '@utils/date.utils';
import {
  ProductDayRepository,
  type ProductDayRow,
} from './product-day.repository';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The products of the week: those of « Aujourd'hui », never the LLM combo
 * nor a retired one (the Monday statement's set since 2026-10-29).
 */
export const WEEK_PRODUCTS: readonly string[] = RESULTS_PRODUCTS.filter(
  (p) => !p.retired && p.source !== 'LLM',
).map((p) => p.key);

export type ProductWeek = {
  /** Its Monday, YYYY-MM-DD. */
  week: string;
  /** Monday to Sunday: each product's outcome that day, when it played. */
  days: {
    date: string;
    marks: { product: string; outcome: ProductDayRow['outcome'] }[];
  }[];
  /**
   * « Favori 5/6 »: won over played; a refunded day is neither (08 § 1),
   * a pending one waits. Products that did not play are left out.
   */
  products: { product: string; won: number; played: number }[];
};

/**
 * One count of the week, read from product_day, for « Ta semaine »
 * (Aujourd'hui on Monday, Résultats) and the Monday statement alike
 * (docs/refonte-ui/08 § 3).
 */
@Injectable()
export class ProductWeekService {
  constructor(private readonly productDays: ProductDayRepository) {}

  async getWeek(monday: string): Promise<ProductWeek> {
    const from = new Date(`${monday}T00:00:00.000Z`);
    const rows = await this.productDays.findDays({
      since: from,
      until: new Date(from.getTime() + 7 * DAY_MS),
      products: WEEK_PRODUCTS,
    });
    const rank = (product: string) => WEEK_PRODUCTS.indexOf(product);
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = formatDateUtc(new Date(from.getTime() + i * DAY_MS));
      return {
        date,
        marks: rows
          .filter((row) => formatDateUtc(row.forDate) === date)
          .sort((a, b) => rank(a.product) - rank(b.product))
          .map((row) => ({ product: row.product, outcome: row.outcome })),
      };
    });
    const products = WEEK_PRODUCTS.flatMap((product) => {
      const own = rows.filter((row) => row.product === product);
      const won = own.filter((row) => row.outcome === 'won').length;
      const played = won + own.filter((row) => row.outcome === 'lost').length;
      return played > 0 ? [{ product, won, played }] : [];
    });
    return { week: monday, days, products };
  }
}
