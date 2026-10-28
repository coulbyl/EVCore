import { Injectable } from '@nestjs/common';
import { FormationContentType } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { createLogger } from '@utils/logger';

const logger = createLogger('gamification-service');

type BadgeCode = 'graduate';

/**
 * Badges retirés le 2026-10-27 : « Vétéran », « Expert », « Maître »
 * récompensaient le nombre de paris joués, « En feu » une série de gains.
 * Ils poussaient à jouer plus, à l'inverse du jeu responsable et du discours
 * du produit (audit du 2026-10-23, P2-9 ; apps/web/PRODUCT.md, principe 5).
 * Plus attribués, plus affichés ; les lignes déjà gagnées restent en base.
 * « Calibré » (Brier < 0,20 sur 50 prédictions) et « Patience » (traverser
 * un drawdown sans override) suivent le 2026-10-27 : aucun code ne les
 * attribuait, ils restaient verrouillés à vie sur le profil. Reste
 * « Diplômé », les cinq fiches de la Formation lues.
 */
const RETIRED_BADGES: ReadonlySet<string> = new Set([
  'vol_50',
  'vol_150',
  'vol_300',
  'streak_5',
  'calibre',
  'patience',
]);

/**
 * Les cinq fiches de la Formation (apps/web/content/formation/articles) :
 * « Diplômé » quand elles sont toutes lues. Avant le 2026-10-27 la liste
 * exigeait dix articles et une vidéo jamais tournée, cachée de l'écran : le
 * badge était impossible à obtenir.
 */
const FORMATION_GRADUATE_ARTICLES = [
  'lire-un-pronostic',
  'cote-et-chances',
  'coupons-et-avis-ia',
  'series-perdantes',
  'erreurs-a-eviter',
] as const;

const FORMATION_GRADUATE_TOTAL = FORMATION_GRADUATE_ARTICLES.length;

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
          contentType: FormationContentType.ARTICLE,
          slug: { in: [...FORMATION_GRADUATE_ARTICLES] },
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
