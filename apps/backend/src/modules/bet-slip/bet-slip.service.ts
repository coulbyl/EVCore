import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { BetSlipRepository } from './bet-slip.repository';
import type { CreateBetSlipDto } from './dto/create-bet-slip.dto';
import type { BetSlipView } from './bet-slip.types';

@Injectable()
export class BetSlipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: BetSlipRepository,
  ) {}

  async create(userId: string, input: CreateBetSlipDto): Promise<BetSlipView> {
    const uniqueBetIds = new Set(input.items.map((item) => item.betId));
    if (uniqueBetIds.size !== input.items.length) {
      throw new BadRequestException('Un bet ne peut apparaître qu’une fois');
    }

    const bets = await this.prisma.client.bet.findMany({
      where: { id: { in: [...uniqueBetIds] } },
      select: { id: true, fixtureId: true },
    });

    if (bets.length !== input.items.length) {
      throw new BadRequestException('Certains bets sont introuvables');
    }

    const existing = await this.prisma.client.betSlipItem.findMany({
      where: {
        userId,
        betId: { in: [...uniqueBetIds] },
      },
      select: { betId: true },
    });

    if (existing.length > 0) {
      throw new BadRequestException(
        'Un ou plusieurs bets sont déjà présents dans un de vos slips',
      );
    }

    const fixtureIds = bets.map((bet) => bet.fixtureId);
    if (new Set(fixtureIds).size !== fixtureIds.length) {
      throw new BadRequestException(
        'Un slip ne peut pas contenir plusieurs bets du même fixture',
      );
    }

    const betById = new Map(bets.map((bet) => [bet.id, bet]));

    const created = await this.prisma.client.$transaction(async (tx) => {
      const betSlip = await tx.betSlip.create({
        data: {
          userId,
          unitStake: new Prisma.Decimal(input.unitStake),
        },
        select: { id: true },
      });

      await tx.betSlipItem.createMany({
        data: input.items.map((item) => ({
          betSlipId: betSlip.id,
          userId,
          betId: item.betId,
          fixtureId: betById.get(item.betId)!.fixtureId,
          stakeOverride:
            item.stakeOverride !== undefined
              ? new Prisma.Decimal(item.stakeOverride)
              : null,
        })),
      });

      return betSlip;
    });

    const betSlip = await this.repository.findUserBetSlipById(
      userId,
      created.id,
    );
    if (!betSlip) {
      throw new NotFoundException('Bet slip introuvable après création');
    }
    return toBetSlipView(betSlip);
  }

  async list(userId: string): Promise<BetSlipView[]> {
    const betSlips = await this.repository.findUserBetSlips(userId);
    return betSlips.map(toBetSlipView);
  }

  async getById(userId: string, betSlipId: string): Promise<BetSlipView> {
    const betSlip = await this.repository.findUserBetSlipById(
      userId,
      betSlipId,
    );
    if (!betSlip) {
      throw new NotFoundException('Bet slip introuvable');
    }
    return toBetSlipView(betSlip);
  }
}

function toBetSlipView(
  betSlip: Awaited<
    ReturnType<BetSlipRepository['findUserBetSlipById']>
  > extends infer T
    ? NonNullable<T>
    : never,
): BetSlipView {
  return {
    id: betSlip.id,
    userId: betSlip.user.id,
    username: betSlip.user.username,
    unitStake: betSlip.unitStake.toFixed(2),
    itemCount: betSlip.items.length,
    createdAt: betSlip.createdAt.toISOString(),
    items: betSlip.items.map((item) => ({
      betId: item.bet.id,
      fixtureId: item.fixture.id,
      fixture: `${item.fixture.homeTeam.name} vs ${item.fixture.awayTeam.name}`,
      market: item.bet.market,
      pick: item.bet.pick,
      odds:
        item.bet.oddsSnapshot !== null
          ? item.bet.oddsSnapshot.toFixed(2)
          : null,
      ev: formatSigned(Number(item.bet.ev), 4),
      stake: (item.stakeOverride ?? betSlip.unitStake).toFixed(2),
      stakeOverride:
        item.stakeOverride !== null ? item.stakeOverride.toFixed(2) : null,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

function formatSigned(value: number, digits: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}`;
}
