import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@evcore/db';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma.service';
import { BetSlipRepository } from './bet-slip.repository';
import type { CreateBetSlipDto } from './dto/create-bet-slip.dto';
import type { BetSlipSummaryView, BetSlipView } from './bet-slip.types';

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
    const existingFixtures = await this.prisma.client.betSlipItem.findMany({
      where: {
        userId,
        fixtureId: { in: fixtureIds },
      },
      distinct: ['fixtureId'],
      select: { fixtureId: true },
    });

    if (existingFixtures.length > 0) {
      throw new BadRequestException(
        'Un ou plusieurs matchs sont déjà présents dans vos tickets',
      );
    }

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

  async getSummary(userId: string, date?: Date): Promise<BetSlipSummaryView> {
    const [{ slipCount, wonBets, lostBets, pendingBets }, globalBets] =
      await Promise.all([
        this.repository.getUserSummary(userId, date),
        this.repository.getGlobalModelBets(date),
      ]);

    const settledBets = wonBets + lostBets;
    const winRate =
      settledBets > 0 ? `${Math.round((wonBets / settledBets) * 100)}%` : '—';

    let totalStaked = new Decimal(0);
    let totalReturned = new Decimal(0);
    const roiBetCount = globalBets.length;

    for (const bet of globalBets) {
      const stake = new Decimal(bet.stakePct.toString());
      totalStaked = totalStaked.plus(stake);
      if (bet.status === 'WON') {
        totalReturned = totalReturned.plus(
          stake.times(bet.oddsSnapshot!.toString()),
        );
      }
    }

    const globalRoi =
      roiBetCount > 0 && totalStaked.gt(0)
        ? `${totalReturned.minus(totalStaked).dividedBy(totalStaked).times(100).toFixed(1)}%`
        : null;

    return {
      slipCount,
      wonBets,
      lostBets,
      pendingBets,
      settledBets,
      winRate,
      globalRoi,
      globalRoiBetCount: roiBetCount,
    };
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
    items: betSlip.items.map((item) => {
      const stake = item.stakeOverride ?? betSlip.unitStake;
      const odds = item.bet.oddsSnapshot;
      const status = item.bet.status;
      return {
        betId: item.bet.id,
        fixtureId: item.fixture.id,
        fixture: `${item.fixture.homeTeam.name} vs ${item.fixture.awayTeam.name}`,
        market: item.bet.market,
        pick: item.bet.pick,
        odds: odds !== null ? odds.toFixed(2) : null,
        ev: formatSigned(Number(item.bet.ev), 4),
        stake: stake.toFixed(2),
        stakeOverride:
          item.stakeOverride !== null ? item.stakeOverride.toFixed(2) : null,
        createdAt: item.createdAt.toISOString(),
        betStatus: status,
        homeScore: item.fixture.homeScore,
        awayScore: item.fixture.awayScore,
        pnl: computePnl(status, stake, odds),
      };
    }),
  };
}

function formatSigned(value: number, digits: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}`;
}

function computePnl(
  status: import('@evcore/db').BetStatus,
  stake: Decimal,
  odds: Decimal | null,
): string | null {
  if (status === 'WON' && odds !== null) {
    const profit = stake.times(odds.minus(1));
    return `+${profit.toFixed(2)}`;
  }
  if (status === 'LOST') {
    return `-${stake.toFixed(2)}`;
  }
  return null;
}
