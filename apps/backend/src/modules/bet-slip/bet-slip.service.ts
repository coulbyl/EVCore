import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BetSlipType,
  BetSource,
  BetStatus,
  Market,
  Prisma,
  StrategyChannel,
} from '@evcore/db';
import Decimal from 'decimal.js';
import { formatMoney } from '@evcore/analysis-core';
import {
  fixedStakeOutcome,
  slipMoney,
  sumSlipMoney,
  type SlipMoney,
} from './bet-slip-outcome';
import { PrismaService } from '@/prisma.service';
import { toPrismaDecimal } from '@utils/prisma.utils';
import { extractModelRunFeatureDiagnostics } from '@utils/model-run.utils';
import { DEFAULT_STAKE_PCT } from '@modules/betting-engine/ev.constants';
import { BankrollService } from '@modules/bankroll/bankroll.service';
import { SLIP_LIMITS } from '@/config/bankroll.constants';
import { BetSlipRepository } from './bet-slip.repository';
import {
  playableQuoteKey,
  type PlayableQuote,
} from '../betting-engine/pricing/playable-odds.repository';
import type { CreateBetSlipDto } from './dto/create-bet-slip.dto';
import type {
  BetSlipResultView,
  BetSlipSummaryView,
  BetSlipView,
} from './bet-slip.types';

function buildPickKey(input: { market: string; pick: string }): string {
  return [input.market, input.pick].join('|');
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
        (p) => p.market === item.market && p.pick === item.pick,
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

    // ── Coupon joué (si applicable) ──────────────────────────────────────
    // Resolved before the transaction: a stale/unknown couponProposalId must
    // never fail the whole bet slip submission over an engagement-tracking
    // mismatch (see CreateBetSlipDto's own doc comment).
    // Le ticket est joué chez le book de l'utilisateur (1xBet), pas chez
    // notre book de référence : quand 1xBet cote le choix, c'est SON prix
    // qui est enregistré, et c'est lui que le règlement paie. Sans relevé
    // 1xBet, le prix de référence reste (docs/audits/2026-10-18/
    // COTES-JOUABLES.md). Jamais une cote fournie par le client.
    const playable = await this.repository
      .findPlayableQuotes(
        resolvedUserPicks.map((r) => ({
          fixtureId: r.fixtureId,
          market: r.market as string,
          pick: r.item.pick!,
        })),
      )
      .catch(() => new Map<string, PlayableQuote>());
    for (const resolved of resolvedUserPicks) {
      const quote = playable.get(
        playableQuoteKey({
          fixtureId: resolved.fixtureId,
          market: resolved.market as string,
          pick: resolved.item.pick!,
        }),
      );
      if (quote?.operatorOdds != null) {
        resolved.oddsSnapshot = new Decimal(quote.operatorOdds);
      }
    }

    let placementCouponId: string | null = null;
    if (input.couponProposalId) {
      const coupon = await this.prisma.client.couponProposal.findUnique({
        where: { id: input.couponProposalId },
        select: { id: true },
      });
      placementCouponId = coupon?.id ?? null;
    }

    // ── Plafond gain potentiel ───────────────────────────────────────────
    const totalOdds = resolvedUserPicks.reduce(
      (acc, r) => acc.times(r.oddsSnapshot),
      new Decimal(1),
    );
    const potentialReturn = new Decimal(input.unitStake).times(totalOdds);
    if (potentialReturn.gt(SLIP_LIMITS.MAX_POTENTIAL_RETURN)) {
      throw new BadRequestException(
        `Gain potentiel (${formatMoney(potentialReturn.toString())}) dépasse le plafond autorisé de ${formatMoney(SLIP_LIMITS.MAX_POTENTIAL_RETURN.toString())}`,
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

        const pickKey = buildPickKey({ market, pick: item.pick! });

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

      if (placementCouponId) {
        // upsert with a no-op update: a user can only ever "play" a given
        // coupon once (unique on [couponProposalId, userId]) — a repeat
        // submission (shouldn't happen, the frontend freezes the button
        // after the first play) leaves the ORIGINAL placement/betSlipId in
        // place rather than reassigning it.
        await tx.couponProposalPlacement.upsert({
          where: {
            couponProposalId_userId: {
              couponProposalId: placementCouponId,
              userId,
            },
          },
          create: {
            couponProposalId: placementCouponId,
            userId,
            betSlipId: betSlip.id,
          },
          update: {},
        });
      }

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

  async getSummary(
    userId: string,
    from?: Date,
    to?: Date,
  ): Promise<BetSlipSummaryView> {
    const [{ slipCount, wonBets, lostBets, pendingBets }, slips] =
      await Promise.all([
        this.repository.getUserSummary(userId, from, to),
        this.repository.getUserPlayedSlips(userId, from, to),
      ]);

    const settledBets = wonBets + lostBets;
    const winRate =
      settledBets > 0 ? `${Math.round((wonBets / settledBets) * 100)}%` : '—';

    const outcome = fixedStakeOutcome(
      slips.map((slip) => ({
        type: slip.type,
        items: slip.items.map((item) => ({
          status: item.bet.status,
          odds: toOdds(item.bet.oddsSnapshot),
        })),
      })),
    );
    const money = sumSlipMoney(
      slips.map((slip) =>
        slipMoney({
          type: slip.type,
          unitStake: new Decimal(slip.unitStake.toString()),
          items: slip.items.map((item) => ({
            status: item.bet.status,
            odds: toOdds(item.bet.oddsSnapshot),
            stake: new Decimal(
              (item.stakeOverride ?? slip.unitStake).toString(),
            ),
          })),
        }),
      ),
    );

    return {
      slipCount,
      wonBets,
      lostBets,
      pendingBets,
      settledBets,
      winRate,
      plays: {
        won: outcome.wonPlays,
        lost: outcome.lostPlays,
        void: outcome.voidPlays,
        pending: outcome.pendingPlays,
        settled: outcome.settledPlays,
        profitUnits: outcome.profitUnits.toFixed(2),
        returnRate: outcome.returnRate?.toFixed(4) ?? null,
      },
      money: {
        settledSlips: money.settledSlips,
        settledStake: money.settledStake.toFixed(2),
        returned: money.returned.toFixed(2),
        net: money.net.toFixed(2),
        pendingStake: money.pendingStake.toFixed(2),
        firstSlipAt: slips[0]?.createdAt.toISOString() ?? null,
      },
    };
  }

  /**
   * Supprimer un coupon saisi par erreur (2026-10-28) : seulement tant
   * qu'aucun de ses matchs n'a commencé et qu'aucune jambe n'est réglée, pour
   * qu'on ne puisse pas effacer un coupon qui part mal. La mise revient au
   * solde par un mouvement « Coupon supprimé ». Rejouable : la suppression et
   * le remboursement partagent une transaction, et un second appel ne trouve
   * plus rien.
   */
  async delete(
    userId: string,
    slipId: string,
    now: Date = new Date(),
  ): Promise<{ refunded: string }> {
    const slip = await this.repository.findDeletableSlip(userId, slipId);
    const firstItem = slip?.items[0];
    if (!slip || !firstItem) throw new NotFoundException('Coupon introuvable');
    const blocker = deletionBlocker(slip.items, now);
    if (blocker === 'settled') {
      throw new ConflictException(
        'Une jambe de ce coupon est déjà réglée : il ne peut plus être supprimé.',
      );
    }
    if (blocker === 'started') {
      throw new ConflictException(
        'Un match de ce coupon a commencé : il ne peut plus être supprimé.',
      );
    }
    // Même mise que celle débitée à la saisie : une fois pour un combiné,
    // jambe par jambe pour des simples.
    const unitStake = new Decimal(slip.unitStake.toString());
    const stake =
      slip.type === BetSlipType.COMBO
        ? unitStake
        : slip.items.reduce(
            (acc, item) =>
              acc.plus(
                item.stakeOverride === null
                  ? unitStake
                  : new Decimal(item.stakeOverride.toString()),
              ),
            new Decimal(0),
          );

    await this.repository.runInTransaction(async (tx) => {
      const deleted = await this.repository.deleteSlip({ slipId, userId }, tx);
      if (!deleted) throw new NotFoundException('Coupon introuvable');
      await this.bankroll.recordSlipCancelled(
        { userId, betId: firstItem.betId, stake },
        { tx },
      );
    });
    return { refunded: stake.toFixed(2) };
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

/**
 * Ce qui empêche de supprimer un coupon, ou null : une jambe réglée, ou un
 * match commencé. Même règle pour la suppression et pour le bouton.
 */
function deletionBlocker(
  items: readonly {
    bet: { status: BetStatus };
    fixture: { scheduledAt: Date };
  }[],
  now: Date,
): 'settled' | 'started' | null {
  if (items.length === 0) return 'settled';
  if (items.some((item) => item.bet.status !== BetStatus.PENDING)) {
    return 'settled';
  }
  const firstKickoff = Math.min(
    ...items.map((item) => item.fixture.scheduledAt.getTime()),
  );
  return firstKickoff <= now.getTime() ? 'started' : null;
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
        homeTeam: item.fixture.homeTeam.name,
        awayTeam: item.fixture.awayTeam.name,
        canal:
          item.bet.channelSelection?.channelDecision.channel ===
          StrategyChannel.SAFE
            ? 'SAFE'
            : 'VALUE',
      };
    }),
    totalOdds:
      betSlip.type === 'COMBO'
        ? betSlip.items
            .reduce(
              (acc, item) =>
                item.bet.oddsSnapshot === null
                  ? acc
                  : acc.times(item.bet.oddsSnapshot.toString()),
              new Decimal(1),
            )
            .toFixed(2)
        : null,
    deletable: deletionBlocker(betSlip.items, new Date()) === null,
    result: toResultView(
      slipMoney({
        type: betSlip.type,
        unitStake: new Decimal(betSlip.unitStake.toString()),
        items: betSlip.items.map((item) => ({
          status: item.bet.status,
          odds: toOdds(item.bet.oddsSnapshot),
          stake: new Decimal(
            (item.stakeOverride ?? betSlip.unitStake).toString(),
          ),
        })),
      }),
    ),
  };
}

function toOdds(value: { toString(): string } | null): Decimal | null {
  return value === null ? null : new Decimal(value.toString());
}

function toResultView(money: SlipMoney): BetSlipResultView {
  return {
    status: money.status,
    staked: money.staked.toFixed(2),
    settledStake: money.settledStake.toFixed(2),
    returned: money.returned.toFixed(2),
    net: money.net.toFixed(2),
    pendingStake: money.pendingStake.toFixed(2),
    potentialReturn: money.potentialReturn.toFixed(2),
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
