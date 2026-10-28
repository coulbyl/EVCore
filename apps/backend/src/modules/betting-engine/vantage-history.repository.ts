import { Injectable } from '@nestjs/common';
import type { BetStatus, Market } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

export type VantageHistoryPlay = { id: string; market: Market; pick: string };

/**
 * Historique en ajout seul des avis VANTAGE (`vantage_decision_history`) :
 * seule source du bilan de l'IA depuis le 2026-10-29. Le règlement n'y écrit
 * que `result` et `settledAt` ; l'avis lui-même n'est jamais modifié.
 */
@Injectable()
export class VantageHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Avis (marché et pari renseignés) écrits pour un match. */
  async findPlaysForFixture(fixtureId: string): Promise<VantageHistoryPlay[]> {
    const rows = await this.prisma.client.vantageDecisionHistory.findMany({
      where: {
        fixtureId,
        status: 'SELECTED',
        market: { not: null },
        pick: { not: null },
      },
      select: { id: true, market: true, pick: true },
    });
    return rows.flatMap((row) =>
      row.market === null || row.pick === null
        ? []
        : [{ id: row.id, market: row.market, pick: row.pick }],
    );
  }

  async applyResults(
    updates: readonly { id: string; result: BetStatus }[],
  ): Promise<void> {
    if (updates.length === 0) return;
    // Écrit seulement quand le résultat change (premier règlement, score
    // corrigé) : un re-règlement ne déplace pas la date d'un avis réglé.
    const settledAt = new Date();
    await this.prisma.client.$transaction(
      updates.map((update) =>
        this.prisma.client.vantageDecisionHistory.updateMany({
          where: {
            id: update.id,
            OR: [{ result: null }, { result: { not: update.result } }],
          },
          data: { result: update.result, settledAt },
        }),
      ),
    );
  }
}
