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
import { NotificationRepository } from './notification.repository';

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

// Messages personnels du mécanisme d'abonnements retiré le 2026-09-03
// (« Abonnement — VALUE (Valeur) », « 1 perdu(s) · -5 000 F »). Les lignes
// restent en base jusqu'à la purge lancée par l'utilisateur, mais ne
// s'affichent plus et ne comptent plus dans la cloche (revue UX du
// 2026-10-27, Notifications P1-1).
const RETIRED_PERSONAL_TYPES: NotificationType[] = [
  NotificationType.SUBSCRIPTION_EVENTS_ADDED,
  NotificationType.SUBSCRIPTION_SETTLED,
];

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

type SaveNotificationInput = {
  type: NotificationType;
  title: string;
  body: string;
  payload: Prisma.InputJsonValue;
};

export type WeeklyReportPayload = {
  roiOneXTwo: number;
  betsPlaced: number;
  brierScore: number;
  periodStart: Date;
  periodEnd: Date;
};

@Injectable()
export class NotificationService {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly mail: MailService,
  ) {}

  private allowedTypes(role: UserRole): NotificationType[] {
    return role === UserRole.ADMIN
      ? Object.values(NotificationType)
      : OPERATOR_TYPES;
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
  }

  async sendBrierScoreAlert(
    seasonId: string,
    brierScore: number,
  ): Promise<void> {
    const title = `Brier Score Alert — Season ${seasonId}`;
    const body = `Brier score ${brierScore.toFixed(4)} exceeds alert threshold (> 0.25)`;
    await this.save({
      type: NotificationType.BRIER_ALERT,
      title,
      body,
      payload: { seasonId, brierScore },
    });
    await this.mail.sendBrierAlert({ seasonId, brierScore });
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
    await this.mail.sendXgUnavailableReport({
      season,
      unavailableCount,
      externalIds,
    });
  }

  async sendWeeklyReport(payload: WeeklyReportPayload): Promise<void> {
    const title = `Weekly Report — ${payload.periodStart.toISOString().slice(0, 10)} → ${payload.periodEnd.toISOString().slice(0, 10)}`;
    const body = [
      `ROI (1X2): ${(payload.roiOneXTwo * 100).toFixed(2)}%`,
      `Bets placed: ${payload.betsPlaced}`,
      `Brier score: ${payload.brierScore.toFixed(4)}`,
    ].join('\n');
    await this.save({
      type: NotificationType.WEEKLY_REPORT,
      title,
      body,
      payload: {
        roiOneXTwo: payload.roiOneXTwo,
        betsPlaced: payload.betsPlaced,
        brierScore: payload.brierScore,
        periodStart: payload.periodStart.toISOString(),
        periodEnd: payload.periodEnd.toISOString(),
      },
    });
    await this.mail.sendWeeklyReport({
      roiOneXTwo: payload.roiOneXTwo,
      betsPlaced: payload.betsPlaced,
      brierScore: payload.brierScore,
      periodStart: payload.periodStart.toISOString(),
      periodEnd: payload.periodEnd.toISOString(),
    });
  }

  async sendMlModelActivatedAlert(payload: {
    versionId: string;
    segment: string;
    algorithm: string;
    brierScore: number;
    calibrationError: number;
    roiSimulated: number;
    isRollback: boolean;
    rolledBackVersionId?: string;
  }): Promise<void> {
    const action = payload.isRollback ? 'Rollback' : 'Auto-Activé';
    const title = `ML Model ${action} — ${payload.segment} (${payload.versionId})`;
    const body = payload.isRollback
      ? `Rollback vers version précédente. Version annulée : ${payload.rolledBackVersionId ?? 'n/a'}`
      : `Brier: ${payload.brierScore.toFixed(4)}, CalErr: ${payload.calibrationError.toFixed(4)}, ROI: ${(payload.roiSimulated * 100).toFixed(2)}%`;
    await this.save({
      type: NotificationType.ML_MODEL_ACTIVATED,
      title,
      body,
      payload: { ...payload },
    });
    await this.mail.sendMlModelActivated(payload);
  }

  async sendMlModelMissingAlert(segments: string[]): Promise<void> {
    const title = `ML Model Missing — ${segments.length} segment(s)`;
    const body = `isActive=true en DB mais absent des active_segments ml-worker : ${segments.join(', ')}`;
    await this.save({
      type: NotificationType.ML_MODEL_MISSING,
      title,
      body,
      payload: { segments },
    });
    await this.mail.sendMlModelMissing({ segments });
  }

  // Broadcast (userId null) — mirrors AnnouncementsService's existing push
  // notification, doesn't replace it: this is what makes a published
  // announcement show up in the bell / `/dashboard/notifications` too,
  // instead of only ever reaching users who already granted push permission.
  async sendAnnouncementPublished(payload: {
    announcementId: string;
    title: string;
    body: string;
    href: string | null;
  }): Promise<void> {
    await this.save({
      type: NotificationType.ANNOUNCEMENT_PUBLISHED,
      title: payload.title,
      body: payload.body,
      payload: { announcementId: payload.announcementId, href: payload.href },
    });
  }

  async list(query: {
    limit: number;
    offset: number;
    unread?: boolean;
    category?: 'announcement' | 'alert';
    type?: NotificationType;
    userId: string;
    role: UserRole;
  }): Promise<{
    data: NotificationView[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const types = this.allowedTypes(query.role);
    // Écran Notifications fusionné (docs/vantage-centric-redesign-2026-09-01.md
    // §0 point 3) — "announcement" est exactement ANNOUNCEMENT_PUBLISHED,
    // "alert" tout le reste. AND-é sur le OR broadcast/personnel ci-dessous :
    // les notifications personnelles ne sont jamais ANNOUNCEMENT_PUBLISHED
    // (toujours broadcast, voir sendAnnouncementPublished), donc ce filtre
    // les exclut naturellement en mode "announcement".
    const categoryFilter: Prisma.NotificationWhereInput =
      query.category === 'announcement'
        ? { type: NotificationType.ANNOUNCEMENT_PUBLISHED }
        : query.category === 'alert'
          ? { type: { not: NotificationType.ANNOUNCEMENT_PUBLISHED } }
          : {};
    // Deux régimes mergés (voir schema.prisma§Notification) : le broadcast
    // filtré par rôle + lu via UserNotificationRead, et le personnel
    // (userId = moi) où `read` sur la ligne elle-même fait foi.
    const where: Prisma.NotificationWhereInput = {
      AND: [
        categoryFilter,
        query.type ? { type: query.type } : {},
        {
          OR: [
            {
              userId: null,
              type: { in: types },
              ...(query.unread
                ? { reads: { none: { userId: query.userId } } }
                : {}),
            },
            {
              userId: query.userId,
              type: { notIn: RETIRED_PERSONAL_TYPES },
              ...(query.unread ? { read: false } : {}),
            },
          ],
        },
      ],
    };
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

  async unreadCount(
    userId: string,
    role: UserRole,
  ): Promise<{ count: number }> {
    const types = this.allowedTypes(role);
    const count = await this.repository.count({
      OR: [
        { userId: null, type: { in: types }, reads: { none: { userId } } },
        { userId, read: false, type: { notIn: RETIRED_PERSONAL_TYPES } },
      ],
    });
    return { count };
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

  async markAllRead(userId: string, role: UserRole): Promise<void> {
    const types = this.allowedTypes(role);
    const unreadBroadcast = await this.repository.findUnreadBroadcasts(
      userId,
      types,
    );
    await Promise.all([
      this.repository.markBroadcastsRead(
        userId,
        unreadBroadcast.map((n) => n.id),
      ),
      this.repository.markAllPersonalRead(userId),
      this.syncAnnouncementReads(
        userId,
        unreadBroadcast
          .filter((n) => n.type === NotificationType.ANNOUNCEMENT_PUBLISHED)
          .map((n) => announcementIdOf(n.payload))
          .filter((id): id is string => id !== null),
      ),
    ]);
  }

  // Notification personnelle (userId non-null) — voir SaveNotificationInput
  // pour le régime broadcast (types système/ops). Ne throw jamais : un échec
  // de persistance ne doit pas faire échouer l'appelant (settlement, matching…).
  async notifyUser(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    payload?: Prisma.InputJsonValue;
  }): Promise<boolean> {
    // Vrai si la notification est écrite : un job qui s'en sert comme trace
    // de ce qu'il a annoncé ne pousse rien d'autre sans elle.
    try {
      await this.repository.create({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: input.payload,
      });
      return true;
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
