import { Injectable } from '@nestjs/common';
import type { Prisma } from '@evcore/db';
import type { FixtureLineupRow } from './fixture-events.types';

@Injectable()
export class FixtureLineupRepository {
  /** Replaces the match's lineups, inside the caller's transaction. */
  async replaceForFixture(input: {
    tx: Prisma.TransactionClient;
    fixtureId: string;
    observedAt: Date;
    rows: readonly FixtureLineupRow[];
  }): Promise<void> {
    const { tx, fixtureId, observedAt } = input;
    await tx.fixtureLineup.deleteMany({ where: { fixtureId } });
    if (input.rows.length > 0) {
      await tx.fixtureLineup.createMany({
        data: input.rows.map((row) => ({ ...row, fixtureId, observedAt })),
      });
    }
  }
}
