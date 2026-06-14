import { BadRequestException, Injectable } from '@nestjs/common';
import { BankrollTransactionType, Prisma } from '@evcore/db';
import Decimal from 'decimal.js';
import { BANKROLL_LIMITS } from '@/config/bankroll.constants';
import { BankrollRepository } from './bankroll.repository';

function formatAmount(amount: Decimal, currency?: string | null): string {
  const value = amount.toNumber();
  if (currency) {
    try {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      // Code devise inconnu — fallback nombre + code brut
      return `${new Intl.NumberFormat('fr-FR').format(value)} ${currency}`;
    }
  }
  return `${new Intl.NumberFormat('fr-FR').format(value)} €`;
}

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
      fixture: r.bet
        ? `${r.bet.fixture.homeTeam.name} vs ${r.bet.fixture.awayTeam.name}`
        : null,
      market: r.bet?.market ?? null,
    }));
  }

  async deposit(
    userId: string,
    amount: number,
    opts?: { note?: string; currency?: string | null },
  ): Promise<{ balance: string }> {
    if (amount <= 0) {
      throw new BadRequestException('Le montant doit être positif');
    }
    if (new Decimal(amount).greaterThan(BANKROLL_LIMITS.MAX_DEPOSIT)) {
      throw new BadRequestException(
        `Le dépôt unitaire ne peut pas dépasser ${formatAmount(BANKROLL_LIMITS.MAX_DEPOSIT, opts?.currency)}`,
      );
    }
    await this.bankrollRepository.insert({
      userId,
      type: BankrollTransactionType.DEPOSIT,
      amount: new Decimal(amount),
      note: opts?.note,
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
      currency?: string | null;
    },
    options?: TransactionOptions,
  ): Promise<void> {
    const win = input.stake.mul(input.odds);
    
    await this.bankrollRepository.insert(
      {
        userId: input.userId,
        type: BankrollTransactionType.BET_WON,
        amount: win,
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
