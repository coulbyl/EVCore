import { Injectable } from '@nestjs/common';
import {
  PRODUCT_DAY_REFRESH_DAYS,
  RESULTS_PRODUCTS,
} from '@config/results.constants';
import { startOfUtcDay } from '@utils/date.utils';
import { createLogger } from '@utils/logger';
import { productDaysOf } from './product-day';
import { ProductDayRepository } from './product-day.repository';

const logger = createLogger('product-day');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Writes product_day from the coupons (docs/refonte-ui/16 § 3): two
 * queries whatever the range, the coupons' legs and one upsert. Replayable.
 */
@Injectable()
export class ProductDayService {
  constructor(private readonly repository: ProductDayRepository) {}

  /** Rewrites every product's days with a `forDate` in [from, to]. */
  async refresh(range: { from: Date; to: Date }): Promise<number> {
    const rows = await this.repository.findProductLegs({
      since: range.from,
      until: range.to,
      products: RESULTS_PRODUCTS,
    });
    const written = await this.repository.upsertDays(
      productDaysOf(rows, RESULTS_PRODUCTS),
    );
    logger.info(
      { from: range.from, to: range.to, written },
      'Product days written',
    );
    return written;
  }

  /** The sliding window of each settlement pass, up to tomorrow. */
  refreshRecent(now: Date = new Date()): Promise<number> {
    const today = startOfUtcDay(now);
    return this.refresh({
      from: new Date(today.getTime() - PRODUCT_DAY_REFRESH_DAYS * DAY_MS),
      to: new Date(today.getTime() + DAY_MS),
    });
  }
}
