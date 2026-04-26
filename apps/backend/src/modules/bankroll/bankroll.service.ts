import { BadRequestException, Injectable } from '@nestjs/common';
import { BankrollTransactionType, Prisma } from '@evcore/db';
import Decimal from 'decimal.js';
import { BankrollRepository } from './bankroll.repository';

type GetTransactionsInput = {
  userId: string;
  from?: Date;
  to?: Date;
  limit?: number;
};

type TransactionOptions = {
  tx?: Prisma.TransactionClient;
};

@Injectable()
export class BankrollService {
  constructor(private readonly bankrollRepository: BankrollRepository) {}

  async getBalance(userId: string): Promise<{ balance: string }> {
    const balance = await this.bankrollRepository.getBalance(userId);
    return { balance: balance.toFixed(2) };
  }

  async getTransactions(input: GetTransactionsInput) {
    const rows = await this.bankrollRepository.getTransactions(input);
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: r.amount.toFixed(2),
      betId: r.betId,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      canal: r.bet ? (r.bet.isSafeValue ? 'SV' : 'EV') : null,
    }));
  }

  async deposit(
    userId: string,
    amount: number,
    note?: string,
  ): Promise<{ balance: string }> {
    if (amount <= 0) {
      throw new BadRequestException('Le montant doit être positif');
    }
    await this.bankrollRepository.insert({
      userId,
      type: BankrollTransactionType.DEPOSIT,
      amount: new Decimal(amount),
      note,
    });
    return this.getBalance(userId);
  }

  async recordBetPlacedBatch(
    userId: string,
    items: Array<{ betId: string; stake: Decimal }>,
    options?: TransactionOptions,
  ): Promise<void> {
    const total = items.reduce((acc, i) => acc.plus(i.stake), new Decimal(0));
    const balance = await this.bankrollRepository.getBalance(userId, options);
    if (balance.lessThan(total)) {
      throw new BadRequestException('Bankroll insuffisante');
    }
    if (items.length === 0) {
      return;
    }
    await this.bankrollRepository.insertMany(
      items.map((item) => ({
        userId,
        type: BankrollTransactionType.BET_PLACED,
        amount: item.stake.negated(),
        betId: item.betId,
      })),
      options,
    );
  }

  async recordBetPlaced(
    input: {
      userId: string;
      betId: string;
      stake: Decimal;
    },
    options?: TransactionOptions,
  ): Promise<void> {
    const balance = await this.bankrollRepository.getBalance(
      input.userId,
      options,
    );
    if (balance.lessThan(input.stake)) {
      throw new BadRequestException('Bankroll insuffisante');
    }
    await this.bankrollRepository.insert(
      {
        userId: input.userId,
        type: BankrollTransactionType.BET_PLACED,
        amount: input.stake.negated(),
        betId: input.betId,
      },
      options,
    );
  }

  async recordBetWon(
    input: {
      userId: string;
      betId: string;
      stake: Decimal;
      odds: Decimal;
    },
    options?: TransactionOptions,
  ): Promise<void> {
    await this.bankrollRepository.insert(
      {
        userId: input.userId,
        type: BankrollTransactionType.BET_WON,
        amount: input.stake.mul(input.odds),
        betId: input.betId,
      },
      options,
    );
  }

  async recordBetVoid(
    input: {
      userId: string;
      betId: string;
      stake: Decimal;
    },
    options?: TransactionOptions,
  ): Promise<void> {
    await this.bankrollRepository.insert(
      {
        userId: input.userId,
        type: BankrollTransactionType.BET_VOID,
        amount: input.stake,
        betId: input.betId,
      },
      options,
    );
  }
}
