import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { SubscriptionsRepository } from './subscriptions.repository';
import type { CreateSubscriptionDto } from './dto/create-subscription.dto';
import {
  SUBSCRIPTION_CHANNEL_PICK_MODES,
  SUBSCRIPTION_LEAGUE_PRESETS,
  SUBSCRIPTION_SOURCES,
  SUBSCRIPTION_TOPN_OPTIONS,
  SUBSCRIPTION_WEEKDAYS,
  findSubscriptionSource,
} from './subscription.constants';

function toDateOnlyUtc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function serializeSubscription(sub: {
  id: string;
  sourceType: string;
  sourceLabel: string;
  channelPickMode: string | null;
  topN: number | null;
  stakePerEvent: Decimal;
  daysOfWeek: number[];
  competitionCodes: string[];
  startDate: Date;
  endDate: Date;
  status: string;
  cancelledAt: Date | null;
  totalEvents: number;
  settledEvents: number;
  wonEvents: number;
  totalStaked: Decimal;
  netPnl: Decimal;
  createdAt: Date;
}) {
  return {
    id: sub.id,
    sourceType: sub.sourceType,
    sourceLabel: sub.sourceLabel,
    channelPickMode: sub.channelPickMode,
    topN: sub.topN,
    stakePerEvent: sub.stakePerEvent.toFixed(2),
    daysOfWeek: sub.daysOfWeek,
    competitionCodes: sub.competitionCodes,
    startDate: sub.startDate.toISOString().slice(0, 10),
    endDate: sub.endDate.toISOString().slice(0, 10),
    status: sub.status,
    cancelledAt: sub.cancelledAt?.toISOString() ?? null,
    totalEvents: sub.totalEvents,
    settledEvents: sub.settledEvents,
    wonEvents: sub.wonEvents,
    totalStaked: sub.totalStaked.toFixed(2),
    netPnl: sub.netPnl.toFixed(2),
    roiPct: sub.totalStaked.greaterThan(0)
      ? sub.netPnl.dividedBy(sub.totalStaked).mul(100).toFixed(2)
      : null,
    createdAt: sub.createdAt.toISOString(),
  };
}

@Injectable()
export class SubscriptionsService {
  constructor(private readonly repository: SubscriptionsRepository) {}

  async getCatalog() {
    const competitions = await this.repository.findActiveCompetitions();
    return {
      sources: SUBSCRIPTION_SOURCES,
      channelPickModes: SUBSCRIPTION_CHANNEL_PICK_MODES,
      topNOptions: SUBSCRIPTION_TOPN_OPTIONS,
      leaguePresets: SUBSCRIPTION_LEAGUE_PRESETS,
      weekdays: SUBSCRIPTION_WEEKDAYS,
      competitions,
    };
  }

  async create(userId: string, dto: CreateSubscriptionDto) {
    const source = findSubscriptionSource(dto.sourceType);
    if (!source) {
      // IsEnum au niveau du DTO empêche déjà ça en pratique — garde-fou
      // explicite si le catalogue et l'enum Prisma venaient à diverger.
      throw new BadRequestException('Source inconnue');
    }

    if (source.kind === 'CHANNEL') {
      if (!dto.channelPickMode) {
        throw new BadRequestException(
          'channelPickMode est obligatoire pour une source canal',
        );
      }
      if (dto.topN === undefined) {
        throw new BadRequestException(
          'topN est obligatoire pour une source canal',
        );
      }
      if (
        !(SUBSCRIPTION_TOPN_OPTIONS as readonly number[]).includes(dto.topN)
      ) {
        throw new BadRequestException(
          `topN doit être l'une de ces valeurs : ${SUBSCRIPTION_TOPN_OPTIONS.join(', ')}`,
        );
      }
    } else {
      // != null (pas !==) : le client peut envoyer explicitement `null` pour
      // ces deux champs sur une source Coupon plutôt que de les omettre.
      if (dto.channelPickMode != null || dto.topN != null) {
        throw new BadRequestException(
          'channelPickMode et topN ne sont pas applicables à une source Coupon',
        );
      }
    }

    const daysOfWeek = Array.from(new Set(dto.daysOfWeek));
    const competitionCodes = Array.from(new Set(dto.competitionCodes));
    if (daysOfWeek.length === 0 && competitionCodes.length === 0) {
      throw new BadRequestException(
        'Choisis au moins un jour de semaine ou au moins un championnat',
      );
    }

    if (competitionCodes.length > 0) {
      const validCodes =
        await this.repository.findActiveCompetitionCodes(competitionCodes);
      const invalid = competitionCodes.filter((c) => !validCodes.includes(c));
      if (invalid.length > 0) {
        throw new BadRequestException(
          `Championnat(s) inconnu(s) ou inactif(s) : ${invalid.join(', ')}`,
        );
      }
    }

    const startDate = toDateOnlyUtc(dto.startDate);
    const endDate = toDateOnlyUtc(dto.endDate);
    if (startDate.getTime() < startOfTodayUtc().getTime()) {
      throw new BadRequestException(
        'La date de début ne peut pas être dans le passé',
      );
    }
    if (endDate.getTime() <= startDate.getTime()) {
      throw new BadRequestException(
        'La date de fin doit être après la date de début',
      );
    }

    const created = await this.repository.create({
      userId,
      sourceType: dto.sourceType,
      sourceLabel: source.label,
      channelPickMode: dto.channelPickMode ?? null,
      topN: dto.topN ?? null,
      stakePerEvent: new Decimal(dto.stakePerEvent),
      daysOfWeek,
      competitionCodes,
      startDate,
      endDate,
    });

    return serializeSubscription(created);
  }

  async list(userId: string) {
    const rows = await this.repository.findByUser(userId);
    return rows.map(serializeSubscription);
  }

  async getDetail(id: string, userId: string) {
    const sub = await this.repository.findByIdForUser(id, userId);
    if (!sub) {
      throw new NotFoundException('Abonnement introuvable');
    }
    const events = await this.repository.findEventsForSubscription(id);
    return {
      ...serializeSubscription(sub),
      // Pas de libellé pré-construit ici : marché/pick sont des codes fermés
      // traduits côté frontend (formatMarketForDisplay/formatPickForDisplay,
      // apps/web/helpers/fixture.ts) — dupliquer ce mapping ici casserait le
      // i18n et la source unique de vérité pour ces libellés.
      events: events.map((e) => ({
        id: e.id,
        date: e.date.toISOString().slice(0, 10),
        kickoff:
          e.channelSelection?.channelDecision.modelRun.fixture.scheduledAt.toISOString() ??
          null,
        fixture: e.channelSelection
          ? {
              homeTeam:
                e.channelSelection.channelDecision.modelRun.fixture.homeTeam
                  .name,
              awayTeam:
                e.channelSelection.channelDecision.modelRun.fixture.awayTeam
                  .name,
            }
          : null,
        market: e.channelSelection?.market ?? null,
        pick: e.channelSelection?.pick ?? null,
        combinedOdds: e.couponProposal?.combinedOdds.toFixed(2) ?? null,
        stake: e.stake.toFixed(2),
        odds: e.odds?.toFixed(2) ?? null,
        result: e.result,
        pnl: e.pnl?.toFixed(2) ?? null,
        settledAt: e.settledAt?.toISOString() ?? null,
      })),
    };
  }

  async cancel(id: string, userId: string) {
    const cancelled = await this.repository.cancel(id, userId);
    if (!cancelled) {
      throw new NotFoundException(
        'Abonnement introuvable ou déjà terminé/annulé',
      );
    }
    return { cancelled: true };
  }
}
