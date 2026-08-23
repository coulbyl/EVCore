import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Decimal from 'decimal.js';
import { createLogger } from '@utils/logger';
import { BULLMQ_QUEUES } from '@config/etl.constants';
import { InvestmentService } from '@modules/investment/investment.service';
import { SubscriptionsRepository } from './subscriptions.repository';
import type { CreateSubscriptionDto } from './dto/create-subscription.dto';
import {
  SUBSCRIPTION_CHANNEL_PICK_MODES,
  SUBSCRIPTION_LEAGUE_PRESETS,
  SUBSCRIPTION_MATCHING_TRIGGER_DEDUP_ID,
  SUBSCRIPTION_MATCHING_TRIGGER_DELAY_MS,
  SUBSCRIPTION_SOURCES,
  SUBSCRIPTION_WEEKDAYS,
  findSubscriptionSource,
  type SubscriptionMatchingJobData,
} from './subscription.constants';

const logger = createLogger('subscriptions');

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
  constructor(
    private readonly repository: SubscriptionsRepository,
    private readonly investments: InvestmentService,
    @InjectQueue(BULLMQ_QUEUES.SUBSCRIPTION_MATCHING)
    private readonly subscriptionMatchingQueue: Queue<SubscriptionMatchingJobData>,
  ) {}

  /**
   * Catalogue des sources proposables, chaque source canal portant ce qui est
   * MESURÉ sur elle.
   *
   * Le catalogue présentait sept canaux à égalité visuelle alors que cinq
   * sont mesurés perdants — le même défaut qu'Investir avait avec ses 18
   * onglets. On ne masque pas les canaux négatifs (un pick d'un canal
   * perdant reste un choix individuel légitime, et masquer ne fait que
   * déplacer la décision hors de vue) : on refuse de les présenter comme
   * équivalents aux deux qui tiennent.
   *
   * Les sources `retired` ne sont pas listées : elles ne sont plus
   * proposables à la création, mais les abonnements existants qui les
   * ciblent continuent de tourner normalement.
   */
  async getCatalog() {
    const competitions = await this.repository.findActiveCompetitions();
    const today = new Date().toISOString().slice(0, 10);
    const stats = await this.investments.listChannelStats(today);

    const sources = SUBSCRIPTION_SOURCES.filter((s) => !s.retired).map(
      (source) => {
        const measured =
          source.channel === undefined ? undefined : stats[source.channel];
        return {
          ...source,
          // `tier` est CALCULÉ, jamais figé : si un canal repasse au-dessus
          // de zéro, il remonte tout seul — et l'inverse aussi.
          tier: measured && measured.roiShrunk > 0 ? 'BACKED' : 'WATCH',
          roiShrunk: measured?.roiShrunk ?? null,
          roiSampleSize: measured?.n ?? null,
        };
      },
    );

    return {
      sources,
      channelPickModes: SUBSCRIPTION_CHANNEL_PICK_MODES,
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
    if (source.retired) {
      throw new BadRequestException(
        `La source ${source.label} n'est plus proposée pour un nouvel abonnement`,
      );
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
      const topNOptions = source.topNOptions ?? [];
      if (!topNOptions.includes(dto.topN)) {
        throw new BadRequestException(
          `topN doit être l'une de ces valeurs : ${topNOptions.join(', ')}`,
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

    // N'a d'effet que si l'abonnement démarre aujourd'hui — sinon rien à
    // matcher avant son startDate, inutile de réveiller le job pour rien.
    if (startDate.getTime() === startOfTodayUtc().getTime()) {
      await this.triggerMatchingSoon();
    }

    return serializeSubscription(created);
  }

  // Évite d'attendre jusqu'à 1h (tick cron ETL_SUBSCRIPTION_MATCHING_CRON) le
  // premier événement d'un abonnement créé aujourd'hui. Le délai + la
  // déduplication BullMQ regroupent plusieurs créations quasi simultanées en
  // un seul run plutôt que d'empiler un job par création (voir
  // subscription.constants.ts pour les valeurs). Best-effort : l'abonnement
  // est déjà créé en base à ce stade, une erreur ici (Redis indisponible…) ne
  // doit jamais faire échouer la requête — le tick cron horaire reste le
  // filet de sécurité.
  private async triggerMatchingSoon(): Promise<void> {
    try {
      await this.subscriptionMatchingQueue.add(
        'subscription-matching',
        {} satisfies SubscriptionMatchingJobData,
        {
          delay: SUBSCRIPTION_MATCHING_TRIGGER_DELAY_MS,
          deduplication: { id: SUBSCRIPTION_MATCHING_TRIGGER_DEDUP_ID },
        },
      );
    } catch (err) {
      logger.warn(
        { err },
        'Failed to enqueue immediate subscription-matching run — will still run on the next hourly tick',
      );
    }
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
              homeLogo:
                e.channelSelection.channelDecision.modelRun.fixture.homeTeam
                  .logoUrl,
              awayLogo:
                e.channelSelection.channelDecision.modelRun.fixture.awayTeam
                  .logoUrl,
              country:
                e.channelSelection.channelDecision.modelRun.fixture.season
                  .competition.country,
            }
          : null,
        market: e.channelSelection?.market ?? null,
        pick: e.channelSelection?.pick ?? null,
        combinedOdds: e.couponProposal?.combinedOdds.toFixed(2) ?? null,
        // Composition du coupon — vide pour un événement CHANNEL_* (déjà
        // porté par fixture/market/pick ci-dessus).
        legs:
          e.couponProposal?.legs.map((leg) => ({
            market: leg.market,
            pick: leg.pick,
            homeTeam: leg.fixture.homeTeam.name,
            awayTeam: leg.fixture.awayTeam.name,
            homeLogo: leg.fixture.homeTeam.logoUrl,
            awayLogo: leg.fixture.awayTeam.logoUrl,
            country: leg.fixture.season.competition.country,
          })) ?? [],
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

  async remove(id: string, userId: string) {
    const removed = await this.repository.remove(id, userId);
    if (!removed) {
      throw new NotFoundException('Abonnement introuvable');
    }
    return { deleted: true };
  }
}
