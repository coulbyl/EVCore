import { BadRequestException, Injectable } from '@nestjs/common';
import { BankrollTransactionType, Prisma } from '@evcore/db';
import Decimal from 'decimal.js';
import { formatMoney } from '@evcore/analysis-core';
import { BANKROLL_LIMITS } from '@/config/bankroll.constants';
import { BankrollRepository } from './bankroll.repository';

function comboLegsOf(
  slip: { type: string; _count: { items: number } } | undefined,
): number | null {
  return slip?.type === 'COMBO' ? slip._count.items : null;
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

  /** Solde et dépôts déclarés, sur tout l'historique. */
  async getSummary(
    userId: string,
  ): Promise<{ balance: string; deposited: string; withdrawn: string }> {
    const [balance, deposited, withdrawn] = await Promise.all([
      this.bankrollRepository.getBalance(userId),
      this.bankrollRepository.getDepositedTotal(userId),
      this.bankrollRepository.getWithdrawnTotal(userId),
    ]);
    return {
      balance: balance.toFixed(2),
      deposited: deposited.toFixed(2),
      withdrawn: withdrawn.toFixed(2),
    };
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
      fixture: r.bet
        ? `${r.bet.fixture.homeTeam.name} vs ${r.bet.fixture.awayTeam.name}`
        : null,
      homeTeam: r.bet?.fixture.homeTeam.name ?? null,
      awayTeam: r.bet?.fixture.awayTeam.name ?? null,
      pick: r.bet?.pick ?? null,
      comboLegs: comboLegsOf(r.bet?.betSlipItems[0]?.betSlip),
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
        `Le dépôt unitaire ne peut pas dépasser ${formatMoney(BANKROLL_LIMITS.MAX_DEPOSIT.toString(), { currency: opts?.currency })}`,
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

  /**
   * Retrait déclaré (2026-10-28), le pendant du dépôt : jamais au-delà du
   * solde. Le verrou par joueur et la lecture du solde partagent la
   * transaction de l'écriture, pour que deux retraits simultanés ne passent
   * pas tous les deux.
   */
  async withdraw(
    userId: string,
    amount: number,
    opts?: { note?: string },
  ): Promise<{ balance: string }> {
    const value = new Decimal(amount);
    if (!value.greaterThan(0)) {
      throw new BadRequestException('Le montant doit être positif');
    }
    await this.bankrollRepository.runInTransaction(async (tx) => {
      await this.bankrollRepository.lockUserBankroll(userId, tx);
      const balance = await this.bankrollRepository.getBalance(userId, { tx });
      if (balance.lessThan(value)) {
        throw new BadRequestException(
          'Tu ne peux pas retirer plus que ton solde.',
        );
      }
      await this.bankrollRepository.insert(
        {
          userId,
          type: BankrollTransactionType.WITHDRAWAL,
          amount: value.negated(),
          note: opts?.note,
        },
        { tx },
      );
    });
    return this.getBalance(userId);
  }

  /** Coupon supprimé avant le coup d'envoi : sa mise revient au solde. */
  async recordSlipCancelled(
    input: { userId: string; betId: string; stake: Decimal },
    options?: TransactionOptions,
  ): Promise<void> {
    await this.bankrollRepository.insert(
      {
        userId: input.userId,
        type: BankrollTransactionType.SLIP_CANCELLED,
        amount: input.stake,
        betId: input.betId,
      },
      options,
    );
  }

  async recordBetPlacedBatch(
    userId: string,
    items: Array<{ betId: string; stake: Decimal }>,
    options?: TransactionOptions,
  ): Promise<void> {
    const total = items.reduce((acc, i) => acc.plus(i.stake), new Decimal(0));
    // Même verrou que le retrait : une saisie et un retrait simultanés ne
    // lisent plus le même solde.
    if (options?.tx) {
      await this.bankrollRepository.lockUserBankroll(userId, options.tx);
    }
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
