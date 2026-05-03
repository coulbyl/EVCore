import { Injectable } from '@nestjs/common';
import { FormationContentType, PredictionChannel } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { createLogger } from '@utils/logger';

const logger = createLogger('gamification-service');

type BadgeCode =
  | 'vol_50'
  | 'vol_150'
  | 'vol_300'
  | 'streak_5'
  | 'patience'
  | 'calibre'
  | 'graduate';

const FORMATION_GRADUATE_ARTICLES = [
  'les-3-canaux',
  'canal-draw',
  'erreurs-frequentes',
  'canal-confiance',
  'cotes-probabilites-implicites',
  'canal-btts',
  'canal-sv',
  'canal-ev',
  'comment-lire-un-pick',
  'ev-probabilites-cotes',
] as const;

const FORMATION_GRADUATE_VIDEOS = ['intro-formation'] as const;

const FORMATION_GRADUATE_TOTAL =
  FORMATION_GRADUATE_ARTICLES.length + FORMATION_GRADUATE_VIDEOS.length;

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
    const [settledBets, predictions, formationProgress] = await Promise.all([
      this.prisma.client.betSlipItem.count({
        where: { userId, bet: { status: { in: ['WON', 'LOST'] } } },
      }),
      this.prisma.client.prediction.findMany({
        orderBy: { createdAt: 'desc' },
        where: {
          channel: PredictionChannel.CONF,
          correct: { not: null },
        },
        select: { correct: true },
        take: 200,
      }),
      this.prisma.client.userContentProgress.findMany({
        where: {
          userId,
          OR: [
            {
              contentType: FormationContentType.ARTICLE,
              slug: { in: [...FORMATION_GRADUATE_ARTICLES] },
            },
            {
              contentType: FormationContentType.VIDEO,
              slug: { in: [...FORMATION_GRADUATE_VIDEOS] },
            },
          ],
        },
        select: { contentType: true, slug: true },
      }),
    ]);

    const completedFormation = new Set(
      formationProgress.map((item) => `${item.contentType}:${item.slug}`),
    );

    const checks: Array<[BadgeCode, boolean]> = [
      ['vol_50', settledBets >= 50],
      ['vol_150', settledBets >= 150],
      ['vol_300', settledBets >= 300],
      ['streak_5', this.hasConsecutiveCorrect(predictions, 5)],
      ['graduate', completedFormation.size >= FORMATION_GRADUATE_TOTAL],
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

  async checkFormationGraduateBadge(userId: string): Promise<void> {
    await this.checkAndAwardBadges(userId);
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
