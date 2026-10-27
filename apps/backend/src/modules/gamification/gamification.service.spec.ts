import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@/prisma.service';
import { GamificationService } from './gamification.service';

const badge = (code: string, name: string) => ({
  code,
  name,
  description: `${name} description`,
  iconUrl: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
});

function makeService(opts: {
  badges?: ReturnType<typeof badge>[];
  userBadges?: Array<{ badgeCode: string; unlockedAt: Date }>;
  progress?: Array<{ contentType: string; slug: string }>;
}) {
  const upsert = vi.fn().mockResolvedValue({});
  const prisma = {
    client: {
      badge: { findMany: vi.fn().mockResolvedValue(opts.badges ?? []) },
      userBadge: {
        findMany: vi.fn().mockResolvedValue(opts.userBadges ?? []),
        upsert,
      },
      userContentProgress: {
        findMany: vi.fn().mockResolvedValue(opts.progress ?? []),
      },
      betSlipItem: { count: vi.fn().mockResolvedValue(500) },
    },
  } as unknown as PrismaService;
  return { service: new GamificationService(prisma), upsert };
}

describe('GamificationService', () => {
  it('hides volume and streak badges, even when the player already earned them', async () => {
    const unlockedAt = new Date('2026-09-01T00:00:00Z');
    const { service } = makeService({
      badges: [
        badge('vol_50', 'Vétéran'),
        badge('vol_150', 'Expert'),
        badge('vol_300', 'Maître'),
        badge('streak_5', 'En feu'),
        badge('patience', 'Patience'),
        badge('calibre', 'Calibré'),
        badge('graduate', 'Diplômé'),
      ],
      userBadges: [
        { badgeCode: 'vol_50', unlockedAt },
        { badgeCode: 'graduate', unlockedAt },
      ],
    });

    const result = await service.getBadgesForUser('u1');

    expect(result.map((b) => b.code)).toEqual([
      'patience',
      'calibre',
      'graduate',
    ]);
    expect(result.find((b) => b.code === 'graduate')?.unlockedAt).toEqual(
      unlockedAt,
    );
  });

  it('never awards a badge for the number of bets played', async () => {
    const { service, upsert } = makeService({ progress: [] });

    await service.checkAndAwardBadges('u1');

    expect(upsert).not.toHaveBeenCalled();
  });

  it('awards the graduate badge once the five sheets are read', async () => {
    const sheets = [
      'lire-un-pronostic',
      'cote-et-chances',
      'coupons-et-avis-ia',
      'series-perdantes',
      'erreurs-a-eviter',
    ];
    const { service, upsert } = makeService({
      progress: sheets.map((slug) => ({ contentType: 'ARTICLE', slug })),
    });

    await service.checkAndAwardBadges('u1');

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0]?.[0]).toMatchObject({
      create: { userId: 'u1', badgeCode: 'graduate' },
    });
  });
});
