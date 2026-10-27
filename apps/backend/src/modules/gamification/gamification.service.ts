import { Injectable } from '@nestjs/common';
import { FormationContentType } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { createLogger } from '@utils/logger';

const logger = createLogger('gamification-service');

type BadgeCode = 'patience' | 'calibre' | 'graduate';

/**
 * Badges retirés le 2026-10-27 : « Vétéran », « Expert », « Maître »
 * récompensaient le nombre de paris joués, « En feu » une série de gains.
 * Ils poussaient à jouer plus, à l'inverse du jeu responsable et du discours
 * du produit (audit du 2026-10-23, P2-9 ; apps/web/PRODUCT.md, principe 5).
 * Plus attribués, plus affichés ; les lignes déjà gagnées restent en base.
 * Restent les badges d'apprentissage : Diplômé, Calibré, Patience.
 */
const RETIRED_BADGES: ReadonlySet<string> = new Set([
  'vol_50',
  'vol_150',
  'vol_300',
  'streak_5',
]);

const FORMATION_GRADUATE_ARTICLES = [
  'channels-overview',
  'draw-channel',
  'erreurs-frequentes',
  'dominant-channel',
  'cotes-probabilites-implicites',
  'btts-channel',
  'safe-channel',
  'value-channel',
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

    return allBadges
      .filter((b) => !RETIRED_BADGES.has(b.code))
      .map((b) => ({
        code: b.code,
        name: b.name,
        description: b.description,
        iconUrl: b.iconUrl,
        unlockedAt: unlockedMap.get(b.code) ?? null,
      }));
  }

  async checkAndAwardBadges(userId: string): Promise<void> {
    const formationProgress =
      await this.prisma.client.userContentProgress.findMany({
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
      });

    const completedFormation = new Set(
      formationProgress.map((item) => `${item.contentType}:${item.slug}`),
    );

    if (completedFormation.size >= FORMATION_GRADUATE_TOTAL) {
      await this.awardBadge(userId, 'graduate');
    }
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
}
