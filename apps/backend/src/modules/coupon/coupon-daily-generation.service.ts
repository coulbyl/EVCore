import { Injectable, Logger } from '@nestjs/common';
import {
  CouponPriceGenerationService,
  type PriceGenerationOutcome,
} from './coupon-price-generation.service';
import {
  CouponFavouriteGenerationService,
  type FavouriteGenerationOutcome,
} from './coupon-favourite-generation.service';

type Failed = { outcome: 'failed'; error: string };

export type DailyGenerationOutcome = {
  price: PriceGenerationOutcome | Failed;
  favourite: FavouriteGenerationOutcome | Failed;
};

/**
 * Les deux générateurs déterministes du lendemain, dans l'ordre, chacun isolé :
 * l'échec de l'un n'empêche jamais l'autre, et aucun des deux ne fait échouer
 * l'analyse qui les précède (le worker garde son propre garde-fou).
 */
@Injectable()
export class CouponDailyGenerationService {
  private readonly logger = new Logger(CouponDailyGenerationService.name);

  constructor(
    private readonly price: CouponPriceGenerationService,
    private readonly favourite: CouponFavouriteGenerationService,
  ) {}

  async generateForDate(forDate: Date): Promise<DailyGenerationOutcome> {
    return {
      price: await this.guard('price composer', () =>
        this.price.generateForDate(forDate),
      ),
      favourite: await this.guard('favourite', () =>
        this.favourite.generateForDate(forDate),
      ),
    };
  }

  private async guard<T>(
    pass: string,
    run: () => Promise<T>,
  ): Promise<T | Failed> {
    try {
      return await run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Coupon pass "${pass}" failed: ${message}`);
      return { outcome: 'failed', error: message };
    }
  }
}
