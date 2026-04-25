import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BetSlipType, BetSource, Market, Prisma } from '@evcore/db';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma.service';
import { toPrismaDecimal } from '@utils/prisma.utils';
import { extractModelRunFeatureDiagnostics } from '@utils/model-run.utils';
import { DEFAULT_STAKE_PCT } from '@modules/betting-engine/ev.constants';
import { BankrollService } from '@modules/bankroll/bankroll.service';
import { BetSlipRepository } from './bet-slip.repository';
import type { CreateBetSlipDto } from './dto/create-bet-slip.dto';
import type { BetSlipSummaryView, BetSlipView } from './bet-slip.types';

function buildPickKey(input: {
  market: string;
  pick: string;
  comboMarket?: string | null;
  comboPick?: string | null;
}): string {
  return [
    input.market,
    input.pick,
    input.comboMarket ?? '-',
    input.comboPick ?? '-',
  ].join('|');
}

@Injectable()
export class BetSlipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: BetSlipRepository,
    private readonly bankroll: BankrollService,
  ) {}

  async create(userId: string, input: CreateBetSlipDto): Promise<BetSlipView> {
    // Sépare les items selon leur type : bet MODEL existant ou pick USER à créer.
    const modelPickItems = input.items.filter((i) => i.betId != null);
    const userPickItems = input.items.filter(
      (i) =>
        i.betId == null &&
        i.modelRunId != null &&
        i.market != null &&
        i.pick != null,
    );

    if (modelPickItems.length + userPickItems.length !== input.items.length) {
      throw new BadRequestException(
        'Chaque item doit avoir soit un betId, soit un modelRunId + market + pick',
      );
    }

    const slipType =
      input.type === BetSlipType.COMBO && input.items.length >= 2
        ? BetSlipType.COMBO
        : BetSlipType.SIMPLE;

    // ── Bets MODEL : charger les bets existants ───────────────────────────
    const modelBetIds = modelPickItems.map((i) => i.betId!);

    if (new Set(modelBetIds).size !== modelBetIds.length) {
      throw new BadRequestException("Un bet ne peut apparaître qu'une fois");
    }

    const modelBets = await this.prisma.client.bet.findMany({
      where: { id: { in: modelBetIds } },
      select: { id: true, fixtureId: true },
    });

    if (modelBets.length !== modelPickItems.length) {
      throw new BadRequestException('Certains bets sont introuvables');
    }

    // ── Picks USER : valider et résoudre ────────────────────────────────
    const modelRunIds = userPickItems.map((i) => i.modelRunId!);
    const modelRuns = await this.prisma.client.modelRun.findMany({
      where: { id: { in: modelRunIds } },
      select: { id: true, features: true, fixture: { select: { id: true } } },
    });

    if (modelRuns.length !== new Set(modelRunIds).size) {
      throw new BadRequestException('Certains model runs sont introuvables');
    }

    const modelRunById = new Map(modelRuns.map((mr) => [mr.id, mr]));

    type UserPickResolved = {
      item: (typeof userPickItems)[0];
      fixtureId: string;
      market: Market;
      probEstimated: Decimal;
      oddsSnapshot: Decimal;
      ev: Decimal;
      qualityScore: Decimal;
    };

    const resolvedUserPicks: UserPickResolved[] = [];

    for (const item of userPickItems) {
      const mr = modelRunById.get(item.modelRunId!);
      if (!mr) throw new BadRequestException('ModelRun introuvable');

      const diag = extractModelRunFeatureDiagnostics(mr.features);
      const evalPick = diag.evaluatedPicks.find(
        (p) =>
          p.market === item.market &&
          p.pick === item.pick &&
          (p.comboMarket ?? null) === (item.comboMarket ?? null) &&
          (p.comboPick ?? null) === (item.comboPick ?? null),
      );

      if (!evalPick) {
        throw new BadRequestException(
          `Pick introuvable dans les sélections évaluées : ${item.market}/${item.pick}`,
        );
      }

      if (!(item.market! in Market)) {
        throw new BadRequestException(`Marché invalide : ${item.market}`);
      }

      resolvedUserPicks.push({
        item,
        fixtureId: mr.fixture.id,
        market: item.market! as Market,
        probEstimated: new Decimal(evalPick.probability),
        oddsSnapshot: new Decimal(evalPick.odds),
        ev: new Decimal(evalPick.ev),
        qualityScore: new Decimal(evalPick.qualityScore),
      });
    }

    // ── Unicité des fixtures dans le slip ────────────────────────────────
    const modelBetFixtureIds = modelBets.map((b) => b.fixtureId);
    const userPickFixtureIds = resolvedUserPicks.map((r) => r.fixtureId);
    const allFixtureIds = [...modelBetFixtureIds, ...userPickFixtureIds];

    if (new Set(allFixtureIds).size !== allFixtureIds.length) {
      throw new BadRequestException(
        'Un slip ne peut pas contenir plusieurs bets du même fixture',
      );
    }

    // ── Créer tout en transaction ────────────────────────────────────────
    const modelBetById = new Map(modelBets.map((b) => [b.id, b]));

    const created = await this.prisma.client.$transaction(async (tx) => {
      // Créer les bets USER
      const userBetItems: Array<{
        betId: string;
        fixtureId: string;
        stakeOverride?: number | null;
      }> = [];

      for (const resolved of resolvedUserPicks) {
        const { item, market, fixtureId } = resolved;
        const comboMarket =
          item.comboMarket && item.comboMarket in Market
            ? (item.comboMarket as Market)
            : undefined;

        const pickKey = buildPickKey({
          market,
          pick: item.pick!,
          comboMarket: comboMarket ?? null,
          comboPick: item.comboPick ?? null,
        });

        const existingBet = await tx.bet.findFirst({
          where: {
            fixtureId,
            pickKey,
            userId,
          },
          select: { id: true },
        });

        const bet =
          existingBet ??
          (await tx.bet.create({
            data: {
              modelRunId: item.modelRunId!,
              fixtureId,
              market,
              pick: item.pick!,
              pickKey,
              ...(comboMarket ? { comboMarket } : {}),
              ...(item.comboPick ? { comboPick: item.comboPick } : {}),
              probEstimated: toPrismaDecimal(resolved.probEstimated, 4),
              oddsSnapshot: toPrismaDecimal(resolved.oddsSnapshot, 3),
              ev: toPrismaDecimal(resolved.ev, 4),
              qualityScore: toPrismaDecimal(resolved.qualityScore, 4),
              stakePct: toPrismaDecimal(DEFAULT_STAKE_PCT, 4),
              source: BetSource.USER,
              userId,
            },
            select: { id: true },
          }));

        userBetItems.push({
          betId: bet.id,
          fixtureId,
          stakeOverride: item.stakeOverride,
        });
      }

      // Créer le BetSlip
      const betSlip = await tx.betSlip.create({
        data: {
          userId,
          type: slipType,
          unitStake: new Prisma.Decimal(input.unitStake),
        },
        select: { id: true },
      });

      // Créer les BetSlipItems
      const betSlipItemsData = [
        ...modelPickItems.map((item) => ({
          betSlipId: betSlip.id,
          userId,
          betId: item.betId!,
          fixtureId: modelBetById.get(item.betId!)!.fixtureId,
          stakeOverride:
            slipType === BetSlipType.SIMPLE && item.stakeOverride != null
              ? new Prisma.Decimal(item.stakeOverride)
              : null,
        })),
        ...userBetItems.map(({ betId, fixtureId, stakeOverride }) => ({
          betSlipId: betSlip.id,
          userId,
          betId,
          fixtureId,
          stakeOverride:
            slipType === BetSlipType.SIMPLE && stakeOverride != null
              ? new Prisma.Decimal(stakeOverride)
              : null,
        })),
      ];

      await tx.betSlipItem.createMany({
        data: betSlipItemsData,
      });

      if (slipType === BetSlipType.COMBO) {
        await this.bankroll.recordBetPlacedBatch(
          userId,
          [
            {
              betId: betSlipItemsData[0].betId,
              stake: new Decimal(input.unitStake),
            },
          ],
          { tx },
        );
      } else {
        await this.bankroll.recordBetPlacedBatch(
          userId,
          betSlipItemsData.map((item) => ({
            betId: item.betId,
            stake: new Decimal(
              (
                item.stakeOverride ?? new Prisma.Decimal(input.unitStake)
              ).toString(),
            ),
          })),
          { tx },
        );
      }

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

  async list(userId: string, from?: Date, to?: Date): Promise<BetSlipView[]> {
    const betSlips = await this.repository.findUserBetSlips(userId, from, to);
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
    type: betSlip.type,
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
        comboMarket: item.bet.comboMarket ?? null,
        comboPick: item.bet.comboPick ?? null,
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
