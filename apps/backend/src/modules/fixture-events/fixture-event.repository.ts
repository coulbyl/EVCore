import { Injectable } from '@nestjs/common';
import type { Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import type { FixtureEventRow } from './fixture-events.types';

export type FixtureDetailIdentity = {
  fixtureId: string;
  scheduledAt: Date;
  /** « Home – Away », for the operators' alerts. */
  label: string;
  /** Provider team id → our team id, both sides. */
  teams: ReadonlyMap<number, string>;
};

@Injectable()
export class FixtureEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findFixtureIdentity(
    fixtureExternalId: number,
  ): Promise<FixtureDetailIdentity | null> {
    const fixture = await this.prisma.client.fixture.findUnique({
      where: { externalId: fixtureExternalId },
      select: {
        id: true,
        scheduledAt: true,
        homeTeam: { select: { id: true, externalId: true, name: true } },
        awayTeam: { select: { id: true, externalId: true, name: true } },
      },
    });
    if (!fixture) return null;
    return {
      fixtureId: fixture.id,
      scheduledAt: fixture.scheduledAt,
      label: `${fixture.homeTeam.name} – ${fixture.awayTeam.name}`,
      teams: new Map([
        [fixture.homeTeam.externalId, fixture.homeTeam.id],
        [fixture.awayTeam.externalId, fixture.awayTeam.id],
      ]),
    };
  }

  /** One transaction for a match's events, lineups and player statistics. */
  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.client.$transaction(fn);
  }

  /** Replaces the match's events; never part of them. */
  async replaceForFixture(input: {
    tx: Prisma.TransactionClient;
    fixtureId: string;
    observedAt: Date;
    rows: readonly FixtureEventRow[];
  }): Promise<void> {
    const { tx, fixtureId, observedAt } = input;
    await tx.fixtureEvent.deleteMany({ where: { fixtureId } });
    if (input.rows.length > 0) {
      await tx.fixtureEvent.createMany({
        data: input.rows.map((row) => ({ ...row, fixtureId, observedAt })),
      });
    }
  }

  /** Nothing left to fetch for this match (the backfill skips it). */
  async markSynced(input: {
    tx: Prisma.TransactionClient;
    fixtureId: string;
    observedAt: Date;
  }): Promise<void> {
    await input.tx.fixture.update({
      where: { id: input.fixtureId },
      data: { eventsSyncedAt: input.observedAt },
    });
  }
}
