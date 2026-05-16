import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';

export type UpsertStandingInput = {
  competitionId: string;
  seasonId: string;
  teamApiId: number;
  teamName: string;
  teamLogo: string;
  group: string;
  rank: number;
  points: number;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goalsFor: number;
  goalsAgainst: number;
  goalsDiff: number;
  form: string | null;
  description: string | null;
};

export type StandingRow = {
  teamApiId: number;
  teamName: string;
  teamLogo: string;
  group: string;
  rank: number;
  points: number;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goalsFor: number;
  goalsAgainst: number;
  goalsDiff: number;
  form: string | null;
  description: string | null;
};

@Injectable()
export class StandingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertMany(entries: UpsertStandingInput[]): Promise<void> {
    await this.prisma.client.$transaction(
      entries.map((entry) =>
        this.prisma.client.standing.upsert({
          where: {
            competitionId_seasonId_teamApiId: {
              competitionId: entry.competitionId,
              seasonId: entry.seasonId,
              teamApiId: entry.teamApiId,
            },
          },
          create: entry,
          update: {
            teamName: entry.teamName,
            teamLogo: entry.teamLogo,
            group: entry.group,
            rank: entry.rank,
            points: entry.points,
            played: entry.played,
            win: entry.win,
            draw: entry.draw,
            lose: entry.lose,
            goalsFor: entry.goalsFor,
            goalsAgainst: entry.goalsAgainst,
            goalsDiff: entry.goalsDiff,
            form: entry.form,
            description: entry.description,
          },
        }),
      ),
    );
  }

  async findByCompetitionAndSeason(
    competitionId: string,
    seasonId: string,
  ): Promise<StandingRow[]> {
    return this.prisma.client.standing.findMany({
      where: { competitionId, seasonId },
      orderBy: [{ group: 'asc' }, { rank: 'asc' }],
      select: {
        teamApiId: true,
        teamName: true,
        teamLogo: true,
        group: true,
        rank: true,
        points: true,
        played: true,
        win: true,
        draw: true,
        lose: true,
        goalsFor: true,
        goalsAgainst: true,
        goalsDiff: true,
        form: true,
        description: true,
      },
    });
  }
}
