import { Injectable } from '@nestjs/common';
import { ResultsService, spanOf } from '@modules/screens/results.service';
import type { ResultsPeriod } from '@modules/screens/results.types';
import { formatDateUtc, startOfUtcDay } from '@utils/date.utils';
import { ConsoleRepository } from './console.repository';
import type { EngineProducts } from './console.types';

/**
 * Moteur — « tient-il ce qu'il annonce ? » (12-admin.md § 2): Résultats'
 * products with retired ones, plus what the player never sees (CLV, the
 * 1xBet margin paid, legs), and the AI by configuration version.
 */
@Injectable()
export class ConsoleEngineService {
  constructor(
    private readonly results: ResultsService,
    private readonly repository: ConsoleRepository,
  ) {}

  async getProducts(
    period: ResultsPeriod,
    now: Date = new Date(),
  ): Promise<EngineProducts> {
    const span = spanOf(period, startOfUtcDay(now));
    const [screen, legs, versions] = await Promise.all([
      this.results.getResults({ period, isAdmin: true }, now),
      this.repository.productLegs(span),
      this.repository.aiVersions({ span, asOf: now }),
    ]);
    const legsOf = new Map(legs.map((row) => [row.product, row]));
    const totalAi = versions.reduce(
      (acc, v) => {
        const n = Number(v.won) + Number(v.lost);
        acc.n += n;
        acc.margin += (v.margin ?? 0) * n;
        acc.marginN += v.margin === null ? 0 : n;
        return acc;
      },
      { n: 0, margin: 0, marginN: 0 },
    );
    return {
      period,
      products: screen.products.map((p) => ({
        product: p.product,
        retired: p.retired,
        launchedOn: p.launchedOn,
        won: p.won,
        lost: p.lost,
        refunded: p.refunded,
        tooEarly: p.tooEarly,
        announced: p.comparison?.announced ?? null,
        realised: p.comparison?.realised ?? null,
        legs: legsOf.get(p.product)?.legs ?? 0,
        clv: legsOf.get(p.product)?.clv ?? null,
        margin: legsOf.get(p.product)?.margin ?? null,
      })),
      ai: {
        won: screen.ai.won,
        lost: screen.ai.lost,
        announced: screen.ai.comparison?.announced ?? null,
        realised: screen.ai.comparison?.realised ?? null,
        margin: totalAi.marginN > 0 ? totalAi.margin / totalAi.marginN : null,
        versions: versions.map((v) => ({
          version: v.version,
          from: formatDateUtc(v.from),
          to: formatDateUtc(v.to),
          won: Number(v.won),
          lost: Number(v.lost),
          announced: v.announced,
          margin: v.margin,
        })),
      },
    };
  }
}
