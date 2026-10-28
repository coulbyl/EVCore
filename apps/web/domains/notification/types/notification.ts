export type NotificationType =
  | "ROI_ALERT"
  | "MARKET_SUSPENSION"
  | "BRIER_ALERT"
  | "WEEKLY_REPORT"
  | "ETL_FAILURE"
  | "WEIGHT_ADJUSTMENT"
  | "XG_UNAVAILABLE_REPORT"
  | "ML_MODEL_ACTIVATED"
  | "ML_MODEL_MISSING"
  // Personnelle (Notification.userId non-null côté backend). Les messages de
  // l'abonnement retiré (SUBSCRIPTION_*) ne sont plus servis depuis le
  // 2026-10-27.
  | "SUPPORT_MESSAGE"
  // Résumé du matin des coupons déclarés réglés la veille (2026-10-28).
  | "SLIPS_SETTLED_DIGEST"
  // La matinée (résultats d'hier + coupons du jour) et le relevé du lundi
  // remplacent le résumé seul depuis le 2026-10-29.
  | "MORNING_BRIEF"
  | "WEEKLY_STATEMENT"
  | "ANNOUNCEMENT_PUBLISHED";

export type NotificationCategory = "announcement" | "alert";

export type NotificationSeverity = "high" | "medium" | "low";

export const NOTIFICATION_SEVERITY: Record<
  NotificationType,
  NotificationSeverity
> = {
  ETL_FAILURE: "high",
  MARKET_SUSPENSION: "high",
  ROI_ALERT: "medium",
  BRIER_ALERT: "medium",
  WEIGHT_ADJUSTMENT: "low",
  WEEKLY_REPORT: "low",
  XG_UNAVAILABLE_REPORT: "low",
  // Alertes admin du ml-worker : un type connu du backend mais absent ici
  // s'affichait avec une gravité indéfinie et un badge vide.
  ML_MODEL_ACTIVATED: "low",
  ML_MODEL_MISSING: "medium",
  SUPPORT_MESSAGE: "low",
  SLIPS_SETTLED_DIGEST: "low",
  MORNING_BRIEF: "low",
  WEEKLY_STATEMENT: "low",
  ANNOUNCEMENT_PUBLISHED: "low",
};

// Types whose `body` is not plain text and must never be rendered directly.
export const NOTIFICATION_BODY_IS_HTML = new Set<NotificationType>([
  "ANNOUNCEMENT_PUBLISHED",
]);

export type NotificationView = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
  isRead: boolean;
};

export type PaginatedNotifications = {
  data: NotificationView[];
  total: number;
  limit: number;
  offset: number;
};
