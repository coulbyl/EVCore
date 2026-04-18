import { Injectable } from '@nestjs/common';
import { BankrollTransactionType, Prisma } from '@evcore/db';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma.service';

type InsertTransactionInput = {
  userId: string;
  type: BankrollTransactionType;
  amount: Decimal;
  betId?: string;
  note?: string;
};

type QueryOptions = {
  tx?: Prisma.TransactionClient;
};

type GetTransactionsInput = {
  userId: string;
  from?: Date;
  to?: Date;
  limit?: number;
};

@Injectable()
export class BankrollRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string, options?: QueryOptions): Promise<Decimal> {
    const result = await (
      options?.tx?.bankrollTransaction ?? this.prisma.client.bankrollTransaction
    ).aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    return result._sum.amount ?? new Decimal(0);
  }

  getTransactions(input: GetTransactionsInput) {
    const { userId, from, to, limit = 100 } = input;
    return this.prisma.client.bankrollTransaction.findMany({
      where: {
        userId,
        ...((from ?? to)
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  insert(input: InsertTransactionInput, options?: QueryOptions) {
    return (
      options?.tx?.bankrollTransaction ?? this.prisma.client.bankrollTransaction
    ).create({
      data: {
        userId: input.userId,
        type: input.type,
        amount: input.amount,
        betId: input.betId,
        note: input.note,
      },
    });
  }

  insertMany(inputs: InsertTransactionInput[], options?: QueryOptions) {
    return (
      options?.tx?.bankrollTransaction ?? this.prisma.client.bankrollTransaction
    ).createMany({
      data: inputs.map((input) => ({
        userId: input.userId,
        type: input.type,
        amount: input.amount,
        betId: input.betId,
        note: input.note,
      })),
    });
  }
}
