import { Injectable } from '@nestjs/common';
import type { StrategyChannel } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

export type FollowedChannelRow = { channel: StrategyChannel; createdAt: Date };

export type FollowedLeagueRow = {
  competitionCode: string;
  createdAt: Date;
  name: string;
  country: string;
};

export type LeagueCatalogRow = {
  code: string;
  name: string;
  country: string;
};

@Injectable()
export class PersonalizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listFollowedChannels(userId: string): Promise<FollowedChannelRow[]> {
    return this.prisma.client.userFollowedChannel.findMany({
      where: { userId },
      select: { channel: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listFollowedLeagues(userId: string): Promise<FollowedLeagueRow[]> {
    const rows = await this.prisma.client.userFollowedLeague.findMany({
      where: { userId },
      select: {
        competitionCode: true,
        createdAt: true,
        competition: { select: { name: true, country: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      competitionCode: r.competitionCode,
      createdAt: r.createdAt,
      name: r.competition.name,
      country: r.competition.country,
    }));
  }

  async findActiveCompetitions(): Promise<LeagueCatalogRow[]> {
    return this.prisma.client.competition.findMany({
      where: { isActive: true },
      select: { code: true, name: true, country: true },
      orderBy: { name: 'asc' },
    });
  }

  async competitionExists(code: string): Promise<boolean> {
    const found = await this.prisma.client.competition.findUnique({
      where: { code, isActive: true },
      select: { code: true },
    });
    return found !== null;
  }

  async followChannel(userId: string, channel: StrategyChannel): Promise<void> {
    await this.prisma.client.userFollowedChannel.upsert({
      where: { userId_channel: { userId, channel } },
      create: { userId, channel },
      update: {},
    });
  }

  async unfollowChannel(
    userId: string,
    channel: StrategyChannel,
  ): Promise<void> {
    await this.prisma.client.userFollowedChannel.deleteMany({
      where: { userId, channel },
    });
  }

  async followLeague(userId: string, competitionCode: string): Promise<void> {
    await this.prisma.client.userFollowedLeague.upsert({
      where: { userId_competitionCode: { userId, competitionCode } },
      create: { userId, competitionCode },
      update: {},
    });
  }

  async unfollowLeague(userId: string, competitionCode: string): Promise<void> {
    await this.prisma.client.userFollowedLeague.deleteMany({
      where: { userId, competitionCode },
    });
  }
}
