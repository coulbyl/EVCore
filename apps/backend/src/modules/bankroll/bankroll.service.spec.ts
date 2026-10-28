import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { BankrollTransactionType } from '@evcore/db';
import Decimal from 'decimal.js';
import { BankrollService } from './bankroll.service';
import type { BankrollRepository } from './bankroll.repository';

function makeRepo(balance = new Decimal(0)): BankrollRepository {
  return {
    getBalance: vi.fn().mockResolvedValue(balance),
    getTransactions: vi.fn().mockResolvedValue([]),
    getDepositedTotal: vi.fn().mockResolvedValue(new Decimal(0)),
    insert: vi.fn().mockResolvedValue({}),
    insertMany: vi.fn().mockResolvedValue({ count: 0 }),
    getWithdrawnTotal: vi.fn().mockResolvedValue(new Decimal(0)),
    lockUserBankroll: vi.fn().mockResolvedValue(undefined),
    runInTransaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({ tx: true }),
    ),
  } as unknown as BankrollRepository;
}

describe('BankrollService', () => {
  describe('getBalance', () => {
    it('returns balance serialized as string', async () => {
      const repo = makeRepo(new Decimal('48320'));
      const service = new BankrollService(repo);
      expect(await service.getBalance('u1')).toEqual({ balance: '48320.00' });
    });

    it('returns 0.00 when no transactions', async () => {
      const repo = makeRepo(new Decimal(0));
      const service = new BankrollService(repo);
      expect(await service.getBalance('u1')).toEqual({ balance: '0.00' });
    });
  });

  describe('deposit', () => {
    it('inserts a DEPOSIT transaction and returns updated balance', async () => {
      const repo = makeRepo(new Decimal('50000'));
      const service = new BankrollService(repo);
      const result = await service.deposit('u1', 50000, {
        note: 'Bankroll initiale',
      });
      expect(repo.insert).toHaveBeenCalledWith({
        userId: 'u1',
        type: BankrollTransactionType.DEPOSIT,
        amount: new Decimal(50000),
        note: 'Bankroll initiale',
      });
      expect(result).toEqual({ balance: '50000.00' });
    });

    it('rejects amount <= 0', async () => {
      const service = new BankrollService(makeRepo());
      await expect(service.deposit('u1', 0)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.deposit('u1', -100)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('recordBetPlaced', () => {
    it('inserts BET_PLACED with negated stake', async () => {
      const repo = makeRepo(new Decimal('10000'));
      const service = new BankrollService(repo);
      await service.recordBetPlaced({
        userId: 'u1',
        betId: 'item-1',
        stake: new Decimal('4000'),
      });
      expect(repo.insert).toHaveBeenCalledWith(
        {
          userId: 'u1',
          type: BankrollTransactionType.BET_PLACED,
          amount: new Decimal('-4000'),
          betId: 'item-1',
        },
        undefined,
      );
    });

    it('rejects if stake exceeds balance', async () => {
      const repo = makeRepo(new Decimal('1000'));
      const service = new BankrollService(repo);
      await expect(
        service.recordBetPlaced({
          userId: 'u1',
          betId: 'item-1',
          stake: new Decimal('5000'),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.insert).not.toHaveBeenCalled();
    });
  });

  describe('recordBetPlacedBatch', () => {
    it('checks the total once and inserts all rows in bulk', async () => {
      const repo = makeRepo(new Decimal('10000'));
      const service = new BankrollService(repo);

      await service.recordBetPlacedBatch('u1', [
        { betId: 'item-1', stake: new Decimal('4000') },
        { betId: 'item-2', stake: new Decimal('1500') },
      ]);

      expect(repo.getBalance).toHaveBeenCalledTimes(1);
      expect(repo.insertMany).toHaveBeenCalledWith(
        [
          {
            userId: 'u1',
            type: BankrollTransactionType.BET_PLACED,
            amount: new Decimal('-4000'),
            betId: 'item-1',
          },
          {
            userId: 'u1',
            type: BankrollTransactionType.BET_PLACED,
            amount: new Decimal('-1500'),
            betId: 'item-2',
          },
        ],
        undefined,
      );
    });

    it('rejects when total stake exceeds balance', async () => {
      const repo = makeRepo(new Decimal('5000'));
      const service = new BankrollService(repo);

      await expect(
        service.recordBetPlacedBatch('u1', [
          { betId: 'item-1', stake: new Decimal('4000') },
          { betId: 'item-2', stake: new Decimal('1500') },
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repo.insertMany).not.toHaveBeenCalled();
    });
  });

  describe('recordBetWon', () => {
    it('inserts BET_WON with stake × odds', async () => {
      const repo = makeRepo();
      const service = new BankrollService(repo);
      await service.recordBetWon({
        userId: 'u1',
        betId: 'item-1',
        stake: new Decimal('4000'),
        odds: new Decimal('2.3'),
      });
      expect(repo.insert).toHaveBeenCalledWith(
        {
          userId: 'u1',
          type: BankrollTransactionType.BET_WON,
          amount: new Decimal('9200'),
          betId: 'item-1',
        },
        undefined,
      );
    });
  });

  describe('recordBetVoid', () => {
    it('inserts BET_VOID with stake returned', async () => {
      const repo = makeRepo();
      const service = new BankrollService(repo);
      await service.recordBetVoid({
        userId: 'u1',
        betId: 'item-1',
        stake: new Decimal('4000'),
      });
      expect(repo.insert).toHaveBeenCalledWith(
        {
          userId: 'u1',
          type: BankrollTransactionType.BET_VOID,
          amount: new Decimal('4000'),
          betId: 'item-1',
        },
        undefined,
      );
    });
  });

  describe('getSummary', () => {
    it('returns the declared balance, deposits and withdrawals', async () => {
      const repo = makeRepo(new Decimal('48320'));
      vi.mocked(repo.getDepositedTotal).mockResolvedValue(new Decimal('60000'));
      vi.mocked(repo.getWithdrawnTotal).mockResolvedValue(new Decimal('5000'));
      const service = new BankrollService(repo);
      expect(await service.getSummary('u1')).toEqual({
        balance: '48320.00',
        deposited: '60000.00',
        withdrawn: '5000.00',
      });
    });
  });

  describe('getTransactions', () => {
    it('serializes transactions to string amounts', async () => {
      const repo = makeRepo();
      vi.mocked(repo.getTransactions).mockResolvedValue([
        {
          id: 'tx-1',
          type: BankrollTransactionType.DEPOSIT,
          amount: new Decimal('50000'),
          betId: null,
          bet: null,
          note: 'Init',
          createdAt: new Date('2026-04-18T10:00:00Z'),
          userId: 'u1',
        },
      ]);
      const service = new BankrollService(repo);
      const result = await service.getTransactions({ userId: 'u1' });
      expect(result).toEqual([
        {
          id: 'tx-1',
          type: BankrollTransactionType.DEPOSIT,
          amount: '50000.00',
          betId: null,
          fixture: null,
          homeTeam: null,
          awayTeam: null,
          pick: null,
          comboLegs: null,
          market: null,
          note: 'Init',
          createdAt: '2026-04-18T10:00:00.000Z',
        },
      ]);
    });
  });
  it('names a combo by its leg count, not by its first match', async () => {
    const repo = makeRepo();
    vi.mocked(repo.getTransactions).mockResolvedValue([
      {
        id: 'tx-2',
        type: BankrollTransactionType.BET_PLACED,
        amount: new Decimal('-1000'),
        betId: 'bet-1',
        note: null,
        createdAt: new Date('2026-10-20T10:00:00Z'),
        userId: 'u1',
        bet: {
          market: 'ONE_X_TWO',
          pick: 'HOME',
          betSlipItems: [{ betSlip: { type: 'COMBO', _count: { items: 2 } } }],
          fixture: {
            homeTeam: { name: 'Ajax' },
            awayTeam: { name: 'PSV' },
          },
        },
      },
    ] as never);
    const service = new BankrollService(repo);
    const [row] = await service.getTransactions({ userId: 'u1' });
    expect(row).toMatchObject({ comboLegs: 2, pick: 'HOME', homeTeam: 'Ajax' });
  });

  describe('withdraw', () => {
    it('writes a negative WITHDRAWAL under the per-player lock', async () => {
      const repo = makeRepo(new Decimal('5000'));
      const service = new BankrollService(repo);
      await service.withdraw('u1', 2000, { note: 'Retrait Wave' });
      expect(repo.lockUserBankroll).toHaveBeenCalledWith('u1', { tx: true });
      expect(repo.getBalance).toHaveBeenCalledWith('u1', { tx: { tx: true } });
      expect(repo.insert).toHaveBeenCalledWith(
        {
          userId: 'u1',
          type: BankrollTransactionType.WITHDRAWAL,
          amount: new Decimal(-2000),
          note: 'Retrait Wave',
        },
        { tx: { tx: true } },
      );
    });

    it('refuses to withdraw more than the balance', async () => {
      const repo = makeRepo(new Decimal('1000'));
      const service = new BankrollService(repo);
      await expect(service.withdraw('u1', 1500)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.insert).not.toHaveBeenCalled();
    });

    it('refuses a zero amount', async () => {
      const service = new BankrollService(makeRepo(new Decimal('1000')));
      await expect(service.withdraw('u1', 0)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
