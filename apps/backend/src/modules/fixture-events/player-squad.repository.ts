import { Injectable } from '@nestjs/common';
import { FixtureStatus, Prisma } from '@evcore/db';
import type { SquadCandidate } from '@evcore/analysis-core';
import { PrismaService } from '@/prisma.service';

/** A player of a squad answer, cleaned (no id 0, no empty name). */
export type SquadPlayerRow = {
  playerExternalId: number;
  name: string;
  number: number | null;
  position: string | null;
  photoUrl: string | null;
};

export type SquadDueTeam = { teamId: string; externalId: number };

@Injectable()
export class PlayerSquadRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Teams playing a scheduled match of an active competition between `from`
   * and `to` whose squad was never written or not since `staleBefore`,
   * the soonest match first.
   */
  async findTeamsDue(input: {
    from: Date;
    to: Date;
    staleBefore: Date;
    limit: number;
    excludeExternalIds: readonly number[];
  }): Promise<SquadDueTeam[]> {
    if (input.limit <= 0) return [];
    const excluded =
      input.excludeExternalIds.length > 0
        ? Prisma.sql`AND t."externalId" NOT IN (${Prisma.join(input.excludeExternalIds)})`
        : Prisma.empty;
    return this.prisma.client.$queryRaw<SquadDueTeam[]>`
      SELECT t.id AS "teamId", t."externalId" AS "externalId"
      FROM public.team t
      JOIN (
        SELECT side."teamId", MIN(f."scheduledAt") AS "nextAt"
        FROM public.fixture f
        JOIN public.season s ON s.id = f."seasonId"
        JOIN public.competition c ON c.id = s."competitionId"
        CROSS JOIN LATERAL (
          VALUES (f."homeTeamId"), (f."awayTeamId")
        ) AS side("teamId")
        WHERE f.status = ${FixtureStatus.SCHEDULED}::"FixtureStatus"
          AND f."scheduledAt" >= ${input.from}
          AND f."scheduledAt" < ${input.to}
          AND c."isActive"
        GROUP BY side."teamId"
      ) soon ON soon."teamId" = t.id
      WHERE (t."squadSyncedAt" IS NULL OR t."squadSyncedAt" < ${input.staleBefore})
        ${excluded}
      ORDER BY soon."nextAt", t."externalId"
      LIMIT ${input.limit}
    `;
  }

  /**
   * Writes a squad answer. A non-empty answer replaces the team's rows (a
   * player who left is no longer listed); an empty one erases nothing. The
   * team is marked either way: what was reported is recorded. A new player
   * enters `player` under the squad's spelling; a known one keeps his name
   * (the match statistics write it in full).
   */
  async replaceSquad(input: {
    teamId: string;
    players: readonly SquadPlayerRow[];
    observedAt: Date;
  }): Promise<void> {
    const { teamId, players, observedAt } = input;
    await this.prisma.client.$transaction(async (tx) => {
      if (players.length > 0) {
        await tx.$executeRaw`
          INSERT INTO public.player ("externalId", name, "photoUrl", "updatedAt")
          VALUES ${Prisma.join(
            players.map(
              (row) =>
                Prisma.sql`(${row.playerExternalId}, ${row.name}, ${row.photoUrl}, now())`,
            ),
          )}
          ON CONFLICT ("externalId") DO NOTHING
        `;
        await tx.playerSquad.deleteMany({ where: { teamId } });
        await tx.playerSquad.createMany({
          data: players.map((row) => ({
            teamId,
            playerExternalId: row.playerExternalId,
            name: row.name,
            number: row.number,
            position: row.position,
            observedAt,
          })),
        });
      }
      await tx.team.update({
        where: { id: teamId },
        data: { squadSyncedAt: observedAt },
      });
    });
  }

  /**
   * The squads of these teams, each player with every spelling we know: the
   * squad's and `player.name`.
   */
  async findCandidates(
    teamIds: readonly string[],
  ): Promise<Map<string, SquadCandidate[]>> {
    const result = new Map<string, SquadCandidate[]>();
    if (teamIds.length === 0) return result;
    const rows = await this.prisma.client.$queryRaw<
      {
        teamId: string;
        playerExternalId: number;
        squadName: string;
        playerName: string | null;
      }[]
    >`
      SELECT ps."teamId", ps."playerExternalId", ps.name AS "squadName",
             p.name AS "playerName"
      FROM public.player_squad ps
      LEFT JOIN public.player p ON p."externalId" = ps."playerExternalId"
      WHERE ps."teamId" = ANY(${[...teamIds]}::uuid[])
    `;
    for (const row of rows) {
      const names = [row.squadName];
      if (row.playerName !== null && row.playerName !== row.squadName) {
        names.push(row.playerName);
      }
      const squad = result.get(row.teamId) ?? [];
      squad.push({ playerExternalId: row.playerExternalId, names });
      result.set(row.teamId, squad);
    }
    return result;
  }

  /** The squads of a fixture's two teams; empty for a team never synced. */
  async findForFixture(fixtureId: string): Promise<{
    home: SquadCandidate[];
    away: SquadCandidate[];
  } | null> {
    const fixture = await this.prisma.client.fixture.findUnique({
      where: { id: fixtureId },
      select: { homeTeamId: true, awayTeamId: true },
    });
    if (!fixture) return null;
    const squads = await this.findCandidates([
      fixture.homeTeamId,
      fixture.awayTeamId,
    ]);
    return {
      home: squads.get(fixture.homeTeamId) ?? [],
      away: squads.get(fixture.awayTeamId) ?? [],
    };
  }

  /** Teams playing between `from` and `to`, and those with a squad since `since`. */
  async countCoverage(input: {
    from: Date;
    to: Date;
    since: Date;
  }): Promise<{ teams: number; synced: number }> {
    const [row] = await this.prisma.client.$queryRaw<
      { teams: bigint; synced: bigint }[]
    >`
      SELECT COUNT(*) AS teams,
             COUNT(*) FILTER (WHERE t."squadSyncedAt" >= ${input.since}) AS synced
      FROM public.team t
      WHERE t.id IN (
        SELECT side."teamId"
        FROM public.fixture f
        JOIN public.season s ON s.id = f."seasonId"
        JOIN public.competition c ON c.id = s."competitionId"
        CROSS JOIN LATERAL (
          VALUES (f."homeTeamId"), (f."awayTeamId")
        ) AS side("teamId")
        WHERE f.status = ${FixtureStatus.SCHEDULED}::"FixtureStatus"
          AND f."scheduledAt" >= ${input.from}
          AND f."scheduledAt" < ${input.to}
          AND c."isActive"
      )
    `;
    return {
      teams: Number(row?.teams ?? 0),
      synced: Number(row?.synced ?? 0),
    };
  }
}
