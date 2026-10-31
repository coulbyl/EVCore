import { Injectable, Logger } from '@nestjs/common';
import {
  CouponPriceGenerationService,
  type PriceGenerationOutcome,
} from './coupon-price-generation.service';
import {
  CouponFavouriteGenerationService,
  type FavouriteGenerationOutcome,
} from './coupon-favourite-generation.service';
import {
  CouponDoubleGenerationService,
  type DoubleGenerationOutcome,
} from './coupon-double-generation.service';
import { CouponPricedPoolService } from './coupon-priced-pool.service';
import {
  CouponHunterGenerationService,
  type HunterPassOutcome,
} from './coupon-hunter-generation.service';
import {
  CouponEngineComboGenerationService,
  ENGINE_COMBO_PROFILE,
  ENGINE_LONG_PROFILE,
  type EngineComboGenerationOutcome,
} from './coupon-engine-combo-generation.service';
import { CouponLegFactService } from './leg-fact/coupon-leg-fact.service';

type Failed = { outcome: 'failed'; error: string };

export type DailyGenerationOutcome = {
  price: PriceGenerationOutcome | Failed;
  favourite: FavouriteGenerationOutcome | Failed;
  double: DoubleGenerationOutcome | Failed;
  combo: EngineComboGenerationOutcome | Failed;
  long: EngineComboGenerationOutcome | Failed;
  /** Chasseurs BTTS, Nul et Score exact. */
  hunters: HunterPassOutcome[] | Failed;
  /** Le fait sous chaque jambe, écrit après toutes les passes. */
  facts: { legs: number; withFact: number } | Failed;
};

/**
 * Les générateurs déterministes du lendemain, dans l'ordre, chacun isolé :
 * l'échec de l'un n'empêche jamais l'autre, et aucun des deux ne fait échouer
 * l'analyse qui les précède (le worker garde son propre garde-fou).
 */
@Injectable()
export class CouponDailyGenerationService {
  private readonly logger = new Logger(CouponDailyGenerationService.name);

  // eslint-disable-next-line max-params -- one injected generator per daily pass.
  constructor(
    private readonly price: CouponPriceGenerationService,
    private readonly favourite: CouponFavouriteGenerationService,
    private readonly double: CouponDoubleGenerationService,
    private readonly combo: CouponEngineComboGenerationService,
    private readonly hunters: CouponHunterGenerationService,
    private readonly pricedPool: CouponPricedPoolService,
    private readonly legFacts: CouponLegFactService,
  ) {}

  async generateForDate(forDate: Date): Promise<DailyGenerationOutcome> {
    // Vivier coté et prix 1xBet chargés une fois pour le coupon cote 2 et les
    // chasseurs ; s'il échoue, chaque passe le relit elle-même.
    const pool = await this.pricedPool.load(forDate).catch((error: unknown) => {
      this.logger.error(
        `Priced pool load failed, passes reload it: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    });
    const outcome = {
      price: await this.guard('price composer', () =>
        this.price.generateForDate(forDate),
      ),
      favourite: await this.guard('favourite', () =>
        this.favourite.generateForDate(forDate),
      ),
      double: await this.guard('double', () =>
        this.double.generateForDate(forDate, pool),
      ),
      combo: await this.guard('engine combo', () =>
        this.combo.generateForDate(forDate, ENGINE_COMBO_PROFILE),
      ),
      long: await this.guard('engine long', () =>
        this.combo.generateForDate(forDate, ENGINE_LONG_PROFILE),
      ),
      hunters: await this.guard('hunters', () =>
        this.hunters.generateForDate(forDate, pool),
      ),
    };
    // Après toutes les passes, pour couvrir chaque jambe écrite ; une panne
    // ici laisse les coupons publiés, sans phrase sous leurs jambes.
    return {
      ...outcome,
      facts: await this.guard('leg facts', () =>
        this.legFacts.fillForDate(forDate),
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
