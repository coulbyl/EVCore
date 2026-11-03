import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@evcore/db';
import { TODAY_PRODUCT_TARGETS } from '@modules/screens/today-products';
import { describe, expect, it, vi } from 'vitest';
import { CouponService } from './coupon.service';
import type { CouponFollowRepository } from './coupon-follow.repository';
import type { CouponRepository } from './coupon.repository';

describe('CouponService.follow', () => {
  const NOW = new Date('2026-10-30T15:00:00.000Z');

  // Le Favori du jour : un coupon d'Aujourd'hui.
  const FAVOURITE = {
    source: 'PRICE_COMPOSER',
    rank: 1,
    targetOddsMin: new Prisma.Decimal(1.1),
  };

  function followHarness(
    firstKickoffAt: Date | null | undefined,
    coupon: Partial<typeof FAVOURITE> = {},
  ) {
    const repo = {
      findFirstKickoff: vi
        .fn()
        .mockResolvedValue(
          firstKickoffAt === undefined
            ? null
            : { firstKickoffAt, ...FAVOURITE, ...coupon },
        ),
    } as unknown as CouponRepository;
    const follows = {
      follow: vi.fn().mockResolvedValue(undefined),
      unfollow: vi.fn().mockResolvedValue(undefined),
      summaryFor: vi.fn().mockResolvedValue({
        won: 7,
        lost: 4,
        refunded: 1,
        since: new Date('2026-10-13T08:30:00.000Z'),
      }),
    } as unknown as CouponFollowRepository;
    return {
      service: new CouponService(repo, follows),
      follows,
    };
  }

  it('follows and unfollows a coupon before its first kick-off', async () => {
    const { service, follows } = followHarness(
      new Date('2026-10-30T19:00:00.000Z'),
    );
    await service.follow('coupon-1', 'u1', NOW);
    await service.unfollow('coupon-1', 'u1', NOW);
    expect(follows.follow).toHaveBeenCalledWith('coupon-1', 'u1');
    expect(follows.unfollow).toHaveBeenCalledWith('coupon-1', 'u1');
  });

  it('refuses both once the first match has kicked off', async () => {
    const { service, follows } = followHarness(NOW);
    await expect(service.follow('coupon-1', 'u1', NOW)).rejects.toBeInstanceOf(
      ConflictException,
    );
    // A losing coupon cannot be dropped from the record either.
    await expect(
      service.unfollow('coupon-1', 'u1', NOW),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(follows.follow).not.toHaveBeenCalled();
    expect(follows.unfollow).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown coupon', async () => {
    const { service, follows } = followHarness(undefined);
    await expect(service.follow('nope', 'u1', NOW)).rejects.toThrow(
      'Coupon introuvable',
    );
    expect(follows.follow).not.toHaveBeenCalled();
  });

  it('a coupon without any leg can still be followed', async () => {
    const { service, follows } = followHarness(null);
    await service.follow('coupon-1', 'u1', NOW);
    expect(follows.follow).toHaveBeenCalled();
  });

  it("refuses a coupon that is not one of Aujourd'hui", async () => {
    const llm = followHarness(new Date('2026-10-30T19:00:00.000Z'), {
      source: 'LLM',
      targetOddsMin: new Prisma.Decimal(1.2),
    });
    await expect(llm.service.follow('c', 'u1', NOW)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    // L'ancien coupon long (2,50), retiré d'Aujourd'hui.
    const long = followHarness(new Date('2026-10-30T19:00:00.000Z'), {
      source: 'ENGINE',
      targetOddsMin: new Prisma.Decimal(2.5),
    });
    await expect(long.service.follow('c', 'u1', NOW)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(llm.follows.follow).not.toHaveBeenCalled();
    expect(long.follows.follow).not.toHaveBeenCalled();
  });

  it('gives the record with the first follow date', async () => {
    const { service, follows } = followHarness(null);
    await expect(service.getFollowedSummary('u1')).resolves.toEqual({
      won: 7,
      lost: 4,
      refunded: 1,
      since: '2026-10-13T08:30:00.000Z',
    });
    expect(follows.summaryFor).toHaveBeenCalledWith({
      userId: 'u1',
      targets: TODAY_PRODUCT_TARGETS,
      range: undefined,
    });
  });
});

describe('CouponService.getAbstentions', () => {
  it('keeps the products whose latest attempt abstained and that have no coupon', async () => {
    const repo = {
      findLatestAttempts: vi.fn().mockResolvedValue([
        {
          pass: 'double',
          outcome: 'abstained',
          reason: 'no_combination_in_window',
        },
        { pass: 'favourite', outcome: 'composed', reason: null },
        // Pas un produit de l'Accueil : jamais expliqué au joueur.
        { pass: 'price-composer', outcome: 'abstained', reason: 'x' },
        {
          pass: 'hunter-hunter_draw',
          outcome: 'abstained',
          reason: 'no_candidate_in_band',
        },
        // Le moteur s'abstient mais le combiné de l'IA (1,2) est publié.
        {
          pass: 'engine-combo',
          outcome: 'abstained',
          reason: 'not_enough_calibrated_short_legs',
        },
      ]),
      findPublishedTargets: vi.fn().mockResolvedValue([1.2]),
    } as unknown as CouponRepository;
    const service = new CouponService(repo, {} as CouponFollowRepository);
    await expect(service.getAbstentions('2026-10-29')).resolves.toEqual([
      { couponClass: 'DOUBLE', reason: 'no_combination_in_window' },
      { couponClass: 'HUNTER_DRAW', reason: 'no_candidate_in_band' },
    ]);
  });
});

describe('CouponService.getProductAbstentions', () => {
  it('reads each product pass with its band and dates every abstention', async () => {
    const repo = {
      findAbstentionsBetween: vi.fn().mockResolvedValue([
        {
          forDate: new Date('2026-10-28T00:00:00.000Z'),
          pass: 'favourite',
          reason: 'no_home_favourite_in_band',
        },
        {
          forDate: new Date('2026-10-29T00:00:00.000Z'),
          pass: 'engine-combo',
          reason: 'not_enough_calibrated_short_legs',
        },
      ]),
    } as unknown as CouponRepository;
    const service = new CouponService(repo, {} as CouponFollowRepository);
    const from = new Date('2026-10-28T00:00:00.000Z');
    const to = new Date('2026-10-30T00:00:00.000Z');
    await expect(service.getProductAbstentions({ from, to })).resolves.toEqual([
      {
        date: '2026-10-28',
        product: 'FAVOURITE',
        reason: 'no_home_favourite_in_band',
      },
      {
        date: '2026-10-29',
        product: 'COMBO',
        reason: 'not_enough_calibrated_short_legs',
      },
    ]);
    const { passes } = vi.mocked(repo.findAbstentionsBetween).mock.calls[0][0];
    expect(passes).toContainEqual({ pass: 'favourite', targetOddsMin: 1.1 });
    expect(passes).toContainEqual({ pass: 'engine-combo', targetOddsMin: 1.2 });
    expect(passes).toContainEqual({
      pass: 'hunter-hunter_ht_draw',
      targetOddsMin: 2.1,
    });
    expect(passes).toHaveLength(9);
  });
});
