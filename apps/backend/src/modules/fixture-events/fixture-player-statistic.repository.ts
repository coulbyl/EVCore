import { Injectable } from '@nestjs/common';
import { Prisma } from '@evcore/db';
import type { FixturePlayerStatisticRow } from './fixture-events.types';

@Injectable()
export class FixturePlayerStatisticRepository {
  /** Replaces the match's player statistics, inside the caller's transaction. */
  async replaceForFixture(input: {
    tx: Prisma.TransactionClient;
    fixtureId: string;
    observedAt: Date;
    rows: readonly FixturePlayerStatisticRow[];
  }): Promise<void> {
    const { tx, fixtureId, observedAt } = input;
    await tx.fixturePlayerStatistic.deleteMany({ where: { fixtureId } });
    if (input.rows.length > 0) {
      await tx.fixturePlayerStatistic.createMany({
        data: input.rows.map((row) => ({
          ...row,
          rating: row.rating === null ? null : new Prisma.Decimal(row.rating),
          fixtureId,
          observedAt,
        })),
      });
    }
  }
}
