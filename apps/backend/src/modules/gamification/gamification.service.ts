import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { createLogger } from '@utils/logger';

const logger = createLogger('gamification-service');

const BADGE_CODES = [
  'vol_50',
  'vol_150',
  'vol_300',
  'streak_5',
  'patience',
  'calibre',
] as const;

type BadgeCode = (typeof BADGE_CODES)[number];

export type UserBadgeDto = {
  code: string;
  name: string;
  description: string;
  iconUrl: string | null;
  unlockedAt: Date | null;
};

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  async getBadgesForUser(userId: string): Promise<UserBadgeDto[]> {
    const [allBadges, userBadges] = await Promise.all([
      this.prisma.client.badge.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.client.userBadge.findMany({
        where: { userId },
        select: { badgeCode: true, unlockedAt: true },
      }),
    ]);

    const unlockedMap = new Map(
      userBadges.map((ub) => [ub.badgeCode, ub.unlockedAt]),
    );

    return allBadges.map((b) => ({
      code: b.code,
      name: b.name,
      description: b.description,
      iconUrl: b.iconUrl,
      unlockedAt: unlockedMap.get(b.code) ?? null,
    }));
  }

  async checkAndAwardBadges(userId: string): Promise<void> {
    const [settledBets, predictions] = await Promise.all([
      this.prisma.client.betSlipItem.count({
        where: { userId, bet: { status: { in: ['WON', 'LOST'] } } },
      }),
      this.prisma.client.prediction.findMany({
        orderBy: { createdAt: 'desc' },
        where: { correct: { not: null } },
        select: { correct: true },
        take: 200,
      }),
    ]);

    const checks: Array<[BadgeCode, boolean]> = [
      ['vol_50', settledBets >= 50],
      ['vol_150', settledBets >= 150],
      ['vol_300', settledBets >= 300],
      ['streak_5', this.hasConsecutiveCorrect(predictions, 5)],
    ];

    await Promise.all(
      checks
        .filter(([, condition]) => condition)
        .map(([code]) => this.awardBadge(userId, code)),
    );
  }

  async checkBrierBadge(
    userId: string,
    brierScore: number,
    predCount: number,
  ): Promise<void> {
    if (predCount >= 50 && brierScore < 0.2) {
      await this.awardBadge(userId, 'calibre');
    }
  }

  async checkPatienceBadge(userId: string): Promise<void> {
    await this.awardBadge(userId, 'patience');
  }

  private async awardBadge(userId: string, code: BadgeCode): Promise<void> {
    try {
      await this.prisma.client.userBadge.upsert({
        where: { userId_badgeCode: { userId, badgeCode: code } },
        update: {},
        create: { userId, badgeCode: code },
      });
    } catch (err) {
      logger.error(
        { userId, code, err: err instanceof Error ? err.message : String(err) },
        'Failed to award badge',
      );
    }
  }

  private hasConsecutiveCorrect(
    predictions: { correct: boolean | null }[],
    n: number,
  ): boolean {
    let streak = 0;
    for (const p of predictions) {
      if (p.correct === true) {
        streak++;
        if (streak >= n) return true;
      } else {
        streak = 0;
      }
    }
    return false;
  }
}
