import { Injectable } from '@nestjs/common';
import { createLogger } from '@utils/logger';
import {
  Market,
  type Notification,
  NotificationType,
  type Prisma,
  UserRole,
} from '@evcore/db';
import { MailService } from '@modules/mail/mail.service';
import type { OpsLightRedProps } from '@evcore/transactional';
import { PushService } from '@modules/push/push.service';
import { PUSH_POLICY } from '@config/push.constants';
import { NOTIFICATION_BELL_WINDOW_DAYS } from '@config/notification.constants';
import { NotificationRepository } from './notification.repository';
import type {
  NotificationCategory,
  NotificationReadStatus,
} from './dto/notification-query.dto';

const logger = createLogger('notification-service');

// Ce qu'un opérateur voit parmi les notifications diffusées (userId null).
// Les notifications personnelles (abonnements, support) lui parviennent par
// son userId, quel que soit leur type.
//
// ROI_ALERT, MARKET_SUSPENSION et WEEKLY_REPORT en sont sortis le
// 2026-10-11 : ce sont des alertes d'ingénierie, rédigées en anglais avec des
// codes bruts (« ROI Alert — RESULT_BTTS · ROI -16.17% over 30 bets »), sur
// un indicateur que le projet ne retient plus comme mesure. Un nouvel inscrit
// en recevait neuf avant d'avoir vu un coupon (revue UX du 2026-10-11, P0-2).
// Elles restent visibles des administrateurs, qui voient tous les types.
const OPERATOR_TYPES: NotificationType[] = [
  NotificationType.ANNOUNCEMENT_PUBLISHED,
];

// Ce que la cloche d'un joueur reçoit à son nom (refonte 09 § 6, 10 § 3) :
// la matinée, la semaine, le résultat d'un coupon suivi et une réponse de
// l'équipe ; l'annonce arrive par OPERATOR_TYPES. Une liste fermée plutôt
// qu'une liste d'exclusions : un type ajouté plus tard n'apparaît pas chez
// le joueur sans qu'on l'ait décidé (le résumé des coupons déclarés,
// SLIPS_SETTLED_DIGEST, y passait encore).
const PLAYER_PERSONAL_TYPES: NotificationType[] = [
  NotificationType.MORNING_BRIEF,
  NotificationType.WEEKLY_STATEMENT,
  NotificationType.FOLLOWED_SETTLED,
  NotificationType.SUPPORT_MESSAGE,
];

// Messages personnels du mécanisme d'abonnements retiré le 2026-09-03
// (« Abonnement — VALUE (Valeur) », « 1 perdu(s) · -5 000 F »). Les lignes
// restent en base jusqu'à la purge lancée par l'utilisateur, mais ne
// s'affichent plus et ne comptent plus dans la cloche (revue UX du
// 2026-10-27, Notifications P1-1).
const RETIRED_PERSONAL_TYPES: NotificationType[] = [
  NotificationType.SUBSCRIPTION_EVENTS_ADDED,
  NotificationType.SUBSCRIPTION_SETTLED,
];

// How long a personal push may wait for an unreachable phone, and how
// urgent it is (config/push.constants.ts).
const PERSONAL_PUSH_POLICY: Partial<
  Record<NotificationType, (typeof PUSH_POLICY)[keyof typeof PUSH_POLICY]>
> = {
  [NotificationType.MORNING_BRIEF]: PUSH_POLICY.MORNING_BRIEF,
  [NotificationType.WEEKLY_STATEMENT]: PUSH_POLICY.WEEKLY_STATEMENT,
  [NotificationType.FOLLOWED_SETTLED]: PUSH_POLICY.FOLLOWED_SETTLED,
  [NotificationType.SUPPORT_MESSAGE]: PUSH_POLICY.SUPPORT_MESSAGE,
};

/** What the bell reads: the last NOTIFICATION_BELL_WINDOW_DAYS days. */
function bellWindow(now: Date = new Date()): Prisma.NotificationWhereInput {
  return {
    createdAt: {
      gte: new Date(now.getTime() - NOTIFICATION_BELL_WINDOW_DAYS * 86_400_000),
    },
  };
}

function announcementIdOf(payload: Prisma.JsonValue | null): string | null {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const id = payload.announcementId;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

export type NotificationView = Omit<Notification, 'read' | 'readAt'> & {
  isRead: boolean;
};

/**
 * The engineering alerts (ETL, stats, ROI, suspension, ML, weights): only
 * an admin's bell holds them (allowedTypes), grouped under « Alertes
 * techniques » on the screen.
 */
export const TECHNICAL_TYPES: NotificationType[] = [
  NotificationType.ROI_ALERT,
  NotificationType.MARKET_SUSPENSION,
  NotificationType.BRIER_ALERT,
  NotificationType.WEEKLY_REPORT,
  NotificationType.ETL_FAILURE,
  NotificationType.WEIGHT_ADJUSTMENT,
  NotificationType.XG_UNAVAILABLE_REPORT,
  NotificationType.ML_MODEL_ACTIVATED,
  NotificationType.ML_MODEL_MISSING,
];

/**
 * "announcement" is exactly ANNOUNCEMENT_PUBLISHED and "alert" every other
 * type (the merged screen of 2026-09-01); "technical" the engineering
 * alerts and "player" everything else — what a player's bell holds.
 */
function categoryWhere(
  category: NotificationCategory | undefined,
): Prisma.NotificationWhereInput {
  switch (category) {
    case 'announcement':
      return { type: NotificationType.ANNOUNCEMENT_PUBLISHED };
    case 'alert':
      return { type: { not: NotificationType.ANNOUNCEMENT_PUBLISHED } };
    case 'technical':
      return { type: { in: TECHNICAL_TYPES } };
    case 'player':
      return { type: { notIn: TECHNICAL_TYPES } };
    default:
      return {};
  }
}

type NotificationFeedFilter = {
  userId: string;
  role: UserRole;
  status?: NotificationReadStatus;
  category?: NotificationCategory;
  type?: NotificationType;
};

type SaveNotificationInput = {
  type: NotificationType;
  title: string;
  body: string;
  payload: Prisma.InputJsonValue;
};

@Injectable()
export class NotificationService {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly mail: MailService,
    private readonly push: PushService,
  ) {}

  private allowedTypes(role: UserRole): NotificationType[] {
    return role === UserRole.ADMIN
      ? Object.values(NotificationType)
      : OPERATOR_TYPES;
  }

  private personalTypes(role: UserRole): Prisma.EnumNotificationTypeFilter {
    return role === UserRole.ADMIN
      ? { notIn: RETIRED_PERSONAL_TYPES }
      : { in: PLAYER_PERSONAL_TYPES };
  }

  async sendRoiAlert(
    market: Market,
    roi: number,
    betCount: number,
  ): Promise<void> {
    const title = `ROI Alert — ${market}`;
    const body = `ROI ${(roi * 100).toFixed(2)}% over ${betCount} bets (threshold: -10%)`;
    await this.save({
      type: NotificationType.ROI_ALERT,
      title,
      body,
      payload: { market, roi, betCount },
    });
    await this.mail.sendRoiAlert({ market: String(market), roi, betCount });
  }

  async sendMarketSuspensionAlert(
    market: Market,
    roi: number,
    betCount: number,
  ): Promise<void> {
    const title = `Market Suspended — ${market}`;
    const body = `Market auto-suspended: ROI ${(roi * 100).toFixed(2)}% over ${betCount} bets (threshold: -15%)`;
    await this.save({
      type: NotificationType.MARKET_SUSPENSION,
      title,
      body,
      payload: { market, roi, betCount },
    });
    await this.mail.sendMarketSuspension({
      market: String(market),
      roi,
      betCount,
    });
    await this.pushOperators({
      title,
      body,
      url: '/admin/engine',
      tag: `market-${market}`,
    });
  }

  async sendEtlFailureAlert(
    queue: string,
    jobName: string,
    errorMessage: string,
  ): Promise<void> {
    const title = `Échec ETL — ${queue}`;
    const body = `Le job "${jobName}" a échoué de façon définitive : ${errorMessage}`;
    await this.save({
      type: NotificationType.ETL_FAILURE,
      title,
      body,
      payload: { queue, jobName, errorMessage },
    });
    await this.mail.sendEtlFailure({ queue, jobName, errorMessage });
    // One per queue on the phone: a queue failing again replaces it.
    await this.pushOperators({
      title,
      body,
      url: '/admin/exploitation',
      tag: `etl-${queue}`,
    });
  }

  /**
   * A light of the admin home turned red (ConsoleWatchService, once per
   * turn): the e-mail to the team and a push to the admins' phones.
   */
  async sendOpsLightRed(props: OpsLightRedProps): Promise<void> {
    await this.mail.sendOpsLightRed(props);
    await this.pushOperators({
      title: `${props.light} au rouge`,
      body: props.lines[0] ?? "À voir dans l'admin",
      url: '/admin',
      tag: `light-${props.light}`,
    });
  }

  async sendWeightAdjustmentAlert(payload: {
    proposalId: string;
    isRollback: boolean;
    brierScore?: number;
    meanError?: number;
    rolledBackProposalId?: string;
  }): Promise<void> {
    const action = payload.isRollback ? 'rolled back' : 'auto-applied';
    const title = `Weight Adjustment ${action} — Proposal ${payload.proposalId}`;
    const body = payload.isRollback
      ? `Proposal ${payload.rolledBackProposalId} rolled back by proposal ${payload.proposalId}`
      : `Weights auto-applied: brierScore=${payload.brierScore?.toFixed(4)}, meanError=${payload.meanError?.toFixed(4)}`;
    await this.save({
      type: NotificationType.WEIGHT_ADJUSTMENT,
      title,
      body,
      payload: { ...payload },
    });
    await this.mail.sendWeightAdjustment(payload);
  }

  async sendXgUnavailableReport(
    season: string,
    externalIds: number[],
  ): Promise<void> {
    const unavailableCount = externalIds.length;
    const title = `Stats Sync — ${unavailableCount} fixtures sans xG (${season})`;
    const body = `${unavailableCount} fixtures marquées xgUnavailable : ${externalIds.join(', ')}`;
    await this.save({
      type: NotificationType.XG_UNAVAILABLE_REPORT,
      title,
      body,
      payload: { season, unavailableCount, externalIds },
    });
    // The bell only: a report, nothing to act on, sent once per league
    // synced (5 to 11 a day in October) — no e-mail, no push.
  }

  /**
   * A published announcement, to every player: the bell's broadcast row,
   * then the push (its author excepted). The row reaches those who never
   * granted the push too.
   */
  async deliverAnnouncement(input: {
    announcementId: string;
    title: string;
    body: string;
    href: string | null;
    authorId: string;
  }): Promise<void> {
    await this.save({
      type: NotificationType.ANNOUNCEMENT_PUBLISHED,
      title: input.title,
      body: input.body,
      payload: { announcementId: input.announcementId, href: input.href },
    });
    await this.push
      .sendToAllUsers(
        {
          title: input.title,
          body: input.body,
          url: input.href ?? '/notifications',
          tag: `announcement-${input.announcementId}`,
        },
        input.authorId,
      )
      .catch((error: unknown) =>
        logger.error(
          {
            announcementId: input.announcementId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to queue the announcement push',
        ),
      );
  }

  /**
   * The one description of « what this player's bell holds »: the list,
   * the badge and « tout marquer comme lu » all read it, so a count and
   * the list next to it always cover the same set (review-expectations).
   * Two regimes merged (schema.prisma § Notification): a broadcast,
   * filtered by role and read through UserNotificationRead, and a personal
   * row (userId = me) whose own `read` is the truth.
   */
  private feedWhere(
    filter: NotificationFeedFilter,
  ): Prisma.NotificationWhereInput {
    const { userId, status } = filter;
    const broadcastRead: Prisma.NotificationWhereInput =
      status === 'unread'
        ? { reads: { none: { userId } } }
        : status === 'read'
          ? { reads: { some: { userId } } }
          : {};
    const personalRead: Prisma.NotificationWhereInput =
      status === 'unread'
        ? { read: false }
        : status === 'read'
          ? { read: true }
          : {};
    return {
      AND: [
        bellWindow(),
        categoryWhere(filter.category),
        filter.type ? { type: filter.type } : {},
        {
          OR: [
            {
              userId: null,
              type: { in: this.allowedTypes(filter.role) },
              ...broadcastRead,
            },
            {
              userId,
              type: this.personalTypes(filter.role),
              ...personalRead,
            },
          ],
        },
      ],
    };
  }

  async list(
    query: NotificationFeedFilter & { limit: number; offset: number },
  ): Promise<{
    data: NotificationView[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const where = this.feedWhere(query);
    const [raw, total] = await Promise.all([
      this.repository.findPage({
        where,
        limit: query.limit,
        offset: query.offset,
        userId: query.userId,
      }),
      this.repository.count(where),
    ]);
    const data: NotificationView[] = raw.map(
      ({ reads, read, readAt: _ra, ...n }) => ({
        ...n,
        isRead: n.userId ? read : reads.length > 0,
      }),
    );
    return { data, total, limit: query.limit, offset: query.offset };
  }

  /** The bell's badge: exactly the list's « Non lues » with no other filter. */
  async unreadCount(
    userId: string,
    role: UserRole,
  ): Promise<{ count: number }> {
    const count = await this.repository.count(
      this.feedWhere({ userId, role, status: 'unread' }),
    );
    return { count };
  }

  /**
   * « Tout marquer comme lu », within the screen's filter (the technical
   * alerts alone, for instance): the same set the list shows unread, so
   * the badge drops by what the list showed. Replayable — a second pass
   * finds nothing left to mark. Returns how many were marked.
   */
  async markAllRead(filter: {
    userId: string;
    role: UserRole;
    category?: NotificationCategory;
  }): Promise<{ marked: number }> {
    const unread = this.feedWhere({ ...filter, status: 'unread' });
    const broadcasts = await this.repository.findBroadcastReadTargets({
      AND: [unread, { userId: null }],
    });
    await this.repository.markBroadcastsRead(
      filter.userId,
      broadcasts.map((row) => row.id),
    );
    const personal = await this.repository.markPersonalReadWhere({
      AND: [unread, { userId: filter.userId }],
    });
    const announcementIds = broadcasts
      .filter((row) => row.type === NotificationType.ANNOUNCEMENT_PUBLISHED)
      .map((row) => announcementIdOf(row.payload))
      .filter((id): id is string => id !== null);
    await this.syncAnnouncementReads(filter.userId, announcementIds);
    return { marked: broadcasts.length + personal };
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.repository.findReadTarget(notificationId);
    if (!notification) return;
    if (notification.userId) {
      // Personnelle — pas de table de lecture partagée, et seul le
      // destinataire peut la marquer lue (scope par userId dans le where).
      await this.repository.markPersonalRead(notificationId, userId);
      return;
    }
    await this.repository.markBroadcastRead(userId, notificationId);
    const announcementId =
      notification.type === NotificationType.ANNOUNCEMENT_PUBLISHED
        ? announcementIdOf(notification.payload)
        : null;
    if (announcementId)
      await this.syncAnnouncementReads(userId, [announcementId]);
  }

  /**
   * Une annonce n'a qu'un état « lu » : la lire dans la cloche la marque lue
   * dans Annonces, et inversement (`markAnnouncementRead`). Il y en avait
   * deux, indépendants (revue UX du 2026-10-27, Notifications P2-6). Une
   * annonce supprimée depuis est ignorée.
   */
  private async syncAnnouncementReads(
    userId: string,
    announcementIds: string[],
  ): Promise<void> {
    if (announcementIds.length === 0) return;
    const existing =
      await this.repository.findExistingAnnouncementIds(announcementIds);
    await this.repository.markAnnouncementsRead(userId, existing);
  }

  /** L'annonce a été ouverte dans Annonces : sa notification devient lue. */
  async markAnnouncementRead(
    userId: string,
    announcementId: string,
  ): Promise<void> {
    const notificationIds =
      await this.repository.findAnnouncementNotificationIds(announcementId);
    await this.repository.markBroadcastsRead(userId, notificationIds);
  }

  /**
   * La conversation a été ouverte : ses réponses ne restent plus non lues
   * dans la cloche. 115 sur 119 l'étaient en base, et la cloche comme l'Inbox
   * comptaient chacune le même message (revue UX du 2026-10-27, P2-5).
   */
  async markSupportMessagesRead(userId: string): Promise<void> {
    await this.repository.markPersonalReadByType(
      userId,
      NotificationType.SUPPORT_MESSAGE,
    );
  }

  /**
   * A personal notification (userId non-null): the bell's row, then — only
   * once it is written — the push that opens `url`. The row is the record
   * of what was announced: a job that keys on it ("not yet notified") tries
   * again on its next run, and never pushes twice. The recipient's
   * preference (morning brief, team replies…) is applied by the caller's
   * recipient query, in bulk. Never throws: a failed write must not fail
   * the caller (settlement, digests). True when the row is written.
   */
  async deliverToUser(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    payload?: Prisma.InputJsonValue;
    /** Opened when the push is tapped. */
    url: string;
    /** A newer push with this tag replaces the shown one (PushPayload.tag). */
    tag: string;
  }): Promise<boolean> {
    let notificationId: string;
    try {
      notificationId = await this.repository.create({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: input.payload,
      });
    } catch (error) {
      logger.error(
        {
          type: input.type,
          userId: input.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to persist personal notification',
      );
      return false;
    }
    // The row is written: a push that cannot be queued is logged, never
    // thrown — the caller's loop (a digest pass, a reply) goes on.
    await this.push
      .sendToUser(
        input.userId,
        {
          title: input.title,
          body: input.body,
          url: input.url,
          notificationId,
          tag: input.tag,
        },
        PERSONAL_PUSH_POLICY[input.type] ?? PUSH_POLICY.DEFAULT,
      )
      .catch((error: unknown) =>
        logger.error(
          {
            type: input.type,
            userId: input.userId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to queue the personal push',
        ),
      );
    return true;
  }

  /** An operations alert on the admins' phones; never throws. */
  private async pushOperators(input: {
    title: string;
    body: string;
    url: string;
    tag: string;
  }): Promise<void> {
    await this.push
      .sendToRole(UserRole.ADMIN, input, PUSH_POLICY.OPERATIONS)
      .catch((error: unknown) =>
        logger.error(
          {
            tag: input.tag,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to queue the operations push',
        ),
      );
  }

  private async save(input: SaveNotificationInput): Promise<void> {
    const { type, title, body, payload } = input;
    try {
      await this.repository.create({ type, title, body, payload });
    } catch (error) {
      logger.error(
        { type, error: error instanceof Error ? error.message : String(error) },
        'Failed to persist notification',
      );
    }
  }
}
