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
    insert: vi.fn().mockResolvedValue({}),
    insertMany: vi.fn().mockResolvedValue({ count: 0 }),
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
      const result = await service.deposit('u1', 50000, 'Bankroll initiale');
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
          note: 'Init',
          createdAt: '2026-04-18T10:00:00.000Z',
        },
      ]);
    });
  });
});
