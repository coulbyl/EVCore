import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { extractEvaContextFromFeatures } from '@utils/model-run.utils';

export type LambdaTotals = Map<string, number>;

/**
 * Lambda (buts attendus Poisson) par ModelRun — utilisé pour détecter les
 * picks GOALS Over/Under dont la direction contredit le propre calcul de
 * buts attendus du modèle (voir investment.service.ts). Vérifié 2026-07-06 :
 * quand le lambda contredit le pick, le taux de réussite chute de 7 à 9
 * points sur des milliers d'échantillons.
 */
@Injectable()
export class InvestmentCoherenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findLambdaTotals(modelRunIds: string[]): Promise<LambdaTotals> {
    if (modelRunIds.length === 0) return new Map();

    const runs = await this.prisma.client.modelRun.findMany({
      where: { id: { in: modelRunIds } },
      select: { id: true, features: true },
    });

    const totals: LambdaTotals = new Map();
    for (const run of runs) {
      const ctx = extractEvaContextFromFeatures(run.features);
      if (ctx.lambdaHome !== null && ctx.lambdaAway !== null) {
        totals.set(run.id, ctx.lambdaHome + ctx.lambdaAway);
      }
    }
    return totals;
  }
}
