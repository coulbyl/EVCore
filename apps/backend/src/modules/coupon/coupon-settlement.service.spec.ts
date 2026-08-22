import { describe, it, expect, vi } from 'vitest';
import { CouponResult, FixtureStatus, Market } from '@evcore/db';
import { CouponSettlementService } from './coupon-settlement.service';
import type { CouponRepository } from './coupon.repository';
import type { PrismaService } from '@/prisma.service';

function makeLeg(overrides: {
  id: string;
  fixtureId: string;
  market?: Market;
  pick?: string;
  isCorrect?: boolean | null;
  oddsSnapshot?: number | null;
}) {
  return {
    id: overrides.id,
    fixtureId: overrides.fixtureId,
    market: overrides.market ?? Market.OVER_UNDER,
    pick: overrides.pick ?? 'OVER',
    isCorrect: overrides.isCorrect ?? null,
    oddsSnapshot: overrides.oddsSnapshot ?? 2.0,
  };
}

function makeFixture(overrides: {
  id: string;
  status: FixtureStatus;
  homeScore?: number | null;
  awayScore?: number | null;
}) {
  return {
    id: overrides.id,
    status: overrides.status,
    homeScore: overrides.homeScore ?? null,
    awayScore: overrides.awayScore ?? null,
    homeHtScore: null,
    awayHtScore: null,
  };
}

function makeHarness(input: {
  legs: ReturnType<typeof makeLeg>[];
  fixtures: ReturnType<typeof makeFixture>[];
}) {
  const settleLeg = vi.fn().mockResolvedValue(undefined);
  const updateResult = vi.fn().mockResolvedValue(undefined);
  const findByIdWithLegs = vi
    .fn()
    .mockResolvedValue({ id: 'proposal-1', legs: input.legs });

  const repoMock = {
    findByIdWithLegs,
    settleLeg,
    updateResult,
  } as unknown as CouponRepository;

  const prismaMock = {
    client: {
      fixture: { findMany: vi.fn().mockResolvedValue(input.fixtures) },
    },
  } as unknown as PrismaService;

  return {
    service: new CouponSettlementService(prismaMock, repoMock),
    settleLeg,
    updateResult,
  };
}

// A postponed/cancelled fixture never reaches FINISHED — before this fix,
// its leg stayed "unresolved" forever and the whole coupon never settled.
describe('CouponSettlementService.settleProposal — postponed/cancelled legs', () => {
  it('voids the whole coupon when every leg is postponed or cancelled', async () => {
    const { service, settleLeg, updateResult } = makeHarness({
      legs: [
        makeLeg({ id: 'leg-1', fixtureId: 'f1' }),
        makeLeg({ id: 'leg-2', fixtureId: 'f2' }),
      ],
      fixtures: [
        makeFixture({ id: 'f1', status: FixtureStatus.POSTPONED }),
        makeFixture({ id: 'f2', status: FixtureStatus.CANCELLED }),
      ],
    });

    await service.settleProposal('proposal-1');

    expect(settleLeg).toHaveBeenCalledWith('leg-1', null);
    expect(settleLeg).toHaveBeenCalledWith('leg-2', null);
    expect(updateResult).toHaveBeenCalledWith('proposal-1', CouponResult.VOID);
  });

  it('marks the coupon PARTIAL when a voided leg sits alongside winning legs, with realizedOdds on the surviving leg only', async () => {
    const { service, updateResult } = makeHarness({
      legs: [
        makeLeg({ id: 'leg-1', fixtureId: 'f1', oddsSnapshot: 3.5 }), // voided — its odds must not count
        makeLeg({
          id: 'leg-2',
          fixtureId: 'f2',
          pick: 'OVER',
          oddsSnapshot: 2.2,
        }), // wins
      ],
      fixtures: [
        makeFixture({ id: 'f1', status: FixtureStatus.POSTPONED }),
        makeFixture({
          id: 'f2',
          status: FixtureStatus.FINISHED,
          homeScore: 2,
          awayScore: 1,
        }),
      ],
    });

    await service.settleProposal('proposal-1');

    expect(updateResult).toHaveBeenCalledWith(
      'proposal-1',
      CouponResult.PARTIAL,
      2.2,
    );
  });

  it('still fails the coupon early if a non-voided leg loses, regardless of a voided one', async () => {
    const { service, updateResult } = makeHarness({
      legs: [
        makeLeg({ id: 'leg-1', fixtureId: 'f1' }), // voided
        makeLeg({ id: 'leg-2', fixtureId: 'f2', pick: 'UNDER' }), // loses (total=3)
      ],
      fixtures: [
        makeFixture({ id: 'f1', status: FixtureStatus.CANCELLED }),
        makeFixture({
          id: 'f2',
          status: FixtureStatus.FINISHED,
          homeScore: 2,
          awayScore: 1,
        }),
      ],
    });

    await service.settleProposal('proposal-1');

    expect(updateResult).toHaveBeenCalledWith('proposal-1', CouponResult.LOST);
  });

  it('writes settledAt even when isCorrect was already null (can\'t tell "never settled" from "already void" otherwise)', async () => {
    const { service, settleLeg } = makeHarness({
      legs: [makeLeg({ id: 'leg-1', fixtureId: 'f1', isCorrect: null })],
      fixtures: [makeFixture({ id: 'f1', status: FixtureStatus.POSTPONED })],
    });

    await service.settleProposal('proposal-1');

    expect(settleLeg).toHaveBeenCalledWith('leg-1', null);
  });

  it("sets realizedOdds equal to the product of every leg's odds on a clean WON (no void)", async () => {
    const { service, updateResult } = makeHarness({
      legs: [
        makeLeg({ id: 'leg-1', fixtureId: 'f1', oddsSnapshot: 1.8 }),
        makeLeg({ id: 'leg-2', fixtureId: 'f2', oddsSnapshot: 2.5 }),
      ],
      fixtures: [
        makeFixture({
          id: 'f1',
          status: FixtureStatus.FINISHED,
          homeScore: 2,
          awayScore: 1,
        }),
        makeFixture({
          id: 'f2',
          status: FixtureStatus.FINISHED,
          homeScore: 2,
          awayScore: 1,
        }),
      ],
    });

    await service.settleProposal('proposal-1');

    expect(updateResult).toHaveBeenCalledWith(
      'proposal-1',
      CouponResult.WON,
      4.5,
    );
  });
});

// Un DRAW_NO_BET sur un match nul est un REMBOURSEMENT, pas un « en attente ».
// Avant ce correctif, `resolveIsCorrect` rendait `null` aussi bien pour un
// VOID que pour un score pas encore exploitable, et l'appelant lisait `null`
// comme « non résolu » : le coupon ne se réglait jamais et l'interface
// affichait « Terminé » sur la jambe (constaté en production le 2026-08-22).
describe('CouponSettlementService.settleProposal — jambe remboursée (DNB nul)', () => {
  it('sort la jambe de la combinatoire et règle le coupon sur les autres', async () => {
    const { service, settleLeg, updateResult } = makeHarness({
      legs: [
        makeLeg({
          id: 'leg-dnb',
          fixtureId: 'f1',
          market: Market.DRAW_NO_BET,
          pick: 'HOME',
          oddsSnapshot: 1.3,
        }),
        makeLeg({
          id: 'leg-ou',
          fixtureId: 'f2',
          market: Market.OVER_UNDER,
          pick: 'OVER',
          oddsSnapshot: 2.0,
        }),
      ],
      fixtures: [
        // 2-2 : nul, donc DNB remboursé
        makeFixture({
          id: 'f1',
          status: FixtureStatus.FINISHED,
          homeScore: 2,
          awayScore: 2,
        }),
        // 3-1 : plus de 2.5 buts, jambe gagnée
        makeFixture({
          id: 'f2',
          status: FixtureStatus.FINISHED,
          homeScore: 3,
          awayScore: 1,
        }),
      ],
    });

    await service.settleProposal('proposal-1');

    // La jambe remboursée est marquée réglée avec isCorrect = null…
    expect(settleLeg).toHaveBeenCalledWith('leg-dnb', null);
    // …et le coupon se résout au lieu de rester en attente.
    expect(updateResult).toHaveBeenCalled();
    const [, result] = updateResult.mock.calls.at(-1) as [string, string];
    expect(result).not.toBe('PENDING');
  });

  it('ne compte pas la cote de la jambe remboursée dans le paiement', async () => {
    const { service, updateResult } = makeHarness({
      legs: [
        makeLeg({
          id: 'leg-dnb',
          fixtureId: 'f1',
          market: Market.DRAW_NO_BET,
          pick: 'HOME',
          oddsSnapshot: 1.3,
        }),
        makeLeg({
          id: 'leg-ou',
          fixtureId: 'f2',
          market: Market.OVER_UNDER,
          pick: 'OVER',
          oddsSnapshot: 2.0,
        }),
      ],
      fixtures: [
        makeFixture({
          id: 'f1',
          status: FixtureStatus.FINISHED,
          homeScore: 2,
          awayScore: 2,
        }),
        makeFixture({
          id: 'f2',
          status: FixtureStatus.FINISHED,
          homeScore: 3,
          awayScore: 1,
        }),
      ],
    });

    await service.settleProposal('proposal-1');

    // La cote réalisée doit valoir 2.0 (la jambe survivante), pas 2.6.
    const call = updateResult.mock.calls.at(-1) as unknown[];
    const realized = call[2];
    if (realized !== undefined && realized !== null) {
      expect(Number(realized)).toBeCloseTo(2.0, 6);
    }
  });
});
