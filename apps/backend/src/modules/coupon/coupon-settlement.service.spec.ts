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
}) {
  return {
    id: overrides.id,
    fixtureId: overrides.fixtureId,
    market: overrides.market ?? Market.OVER_UNDER,
    pick: overrides.pick ?? 'OVER',
    isCorrect: overrides.isCorrect ?? null,
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

  it('marks the coupon PARTIAL when a voided leg sits alongside winning legs', async () => {
    const { service, updateResult } = makeHarness({
      legs: [
        makeLeg({ id: 'leg-1', fixtureId: 'f1' }), // voided
        makeLeg({ id: 'leg-2', fixtureId: 'f2', pick: 'OVER' }), // wins
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
});
