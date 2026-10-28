import { describe, it, expect, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { BetStatus } from '@evcore/db';
import type { PrismaService } from '@/prisma.service';
import type { BankrollService } from '@modules/bankroll/bankroll.service';
import { BetSlipService } from './bet-slip.service';
import type { BetSlipRepository, DeletableSlip } from './bet-slip.repository';

const NOW = new Date('2026-10-28T15:00:00Z');
const LATER = new Date('2026-10-28T19:00:00Z');
const EARLIER = new Date('2026-10-28T14:00:00Z');

function slip(overrides: Partial<DeletableSlip> = {}): DeletableSlip {
  return {
    id: 'slip-1',
    type: 'SIMPLE',
    unitStake: new Decimal(1000) as unknown as DeletableSlip['unitStake'],
    items: [
      {
        betId: 'bet-1',
        stakeOverride: null,
        bet: { status: BetStatus.PENDING },
        fixture: { scheduledAt: LATER },
      },
      {
        betId: 'bet-2',
        stakeOverride: new Decimal(500) as unknown as Decimal &
          DeletableSlip['unitStake'],
        bet: { status: BetStatus.PENDING },
        fixture: { scheduledAt: LATER },
      },
    ],
    ...overrides,
  };
}

function makeHarness(found: DeletableSlip | null, deleted = true) {
  const tx = { tx: true };
  const repository = {
    findDeletableSlip: vi.fn().mockResolvedValue(found),
    runInTransaction: vi.fn((fn: (client: unknown) => Promise<unknown>) =>
      fn(tx),
    ),
    deleteSlip: vi.fn().mockResolvedValue(deleted),
  } as unknown as BetSlipRepository;
  const bankroll = {
    recordSlipCancelled: vi.fn().mockResolvedValue(undefined),
  } as unknown as BankrollService;
  return {
    service: new BetSlipService({} as PrismaService, repository, bankroll),
    repository,
    bankroll,
    tx,
  };
}

describe('BetSlipService.delete', () => {
  it('deletes a slip before kick-off and refunds every simple stake', async () => {
    const { service, repository, bankroll, tx } = makeHarness(slip());
    await expect(service.delete('u1', 'slip-1', NOW)).resolves.toEqual({
      refunded: '1500.00',
    });
    expect(repository.deleteSlip).toHaveBeenCalledWith(
      { slipId: 'slip-1', userId: 'u1' },
      tx,
    );
    expect(bankroll.recordSlipCancelled).toHaveBeenCalledWith(
      { userId: 'u1', betId: 'bet-1', stake: new Decimal(1500) },
      { tx },
    );
  });

  it('refunds a combo once, at its unit stake', async () => {
    const { service } = makeHarness(slip({ type: 'COMBO' }));
    await expect(service.delete('u1', 'slip-1', NOW)).resolves.toEqual({
      refunded: '1000.00',
    });
  });

  it('refuses once a match of the slip has started', async () => {
    const started = slip();
    started.items[1].fixture.scheduledAt = EARLIER;
    const { service, bankroll } = makeHarness(started);
    await expect(service.delete('u1', 'slip-1', NOW)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(bankroll.recordSlipCancelled).not.toHaveBeenCalled();
  });

  it('refuses once a leg is settled', async () => {
    const settled = slip();
    settled.items[0].bet.status = BetStatus.VOID;
    const { service } = makeHarness(settled);
    await expect(service.delete('u1', 'slip-1', NOW)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("answers 404 for another player's slip or a slip already deleted", async () => {
    await expect(
      makeHarness(null).service.delete('u1', 'slip-1', NOW),
    ).rejects.toBeInstanceOf(NotFoundException);
    // Deleted between the read and the transaction: no refund is written.
    const race = makeHarness(slip(), false);
    await expect(
      race.service.delete('u1', 'slip-1', NOW),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(race.bankroll.recordSlipCancelled).not.toHaveBeenCalled();
  });
});
