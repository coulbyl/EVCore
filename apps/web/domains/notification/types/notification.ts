export type NotificationType =
  | "ROI_ALERT"
  | "MARKET_SUSPENSION"
  | "BRIER_ALERT"
  | "WEEKLY_REPORT"
  | "ETL_FAILURE"
  | "WEIGHT_ADJUSTMENT"
  | "XG_UNAVAILABLE_REPORT"
  // Personnelles (Notification.userId non-null côté backend) — voir
  // subscription-notifier.service.ts.
  | "SUBSCRIPTION_EVENTS_ADDED"
  | "SUBSCRIPTION_SETTLED"
  | "SUPPORT_MESSAGE"
  | "ANNOUNCEMENT_PUBLISHED";

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
  // Informationnelles, jamais critiques — même palette que WEEKLY_REPORT.
  SUBSCRIPTION_EVENTS_ADDED: "low",
  SUBSCRIPTION_SETTLED: "low",
  SUPPORT_MESSAGE: "low",
  ANNOUNCEMENT_PUBLISHED: "low",
};

// Where "voir plus" should navigate to for types whose full content lives on
// another page — `ANNOUNCEMENT_PUBLISHED`'s body is rich-text HTML (the
// admin editor's output), never meant to be dumped as raw markup in the
// notification list, so it's hidden there in favor of this link.
export const NOTIFICATION_LINKS: Partial<Record<NotificationType, string>> = {
  SUPPORT_MESSAGE: "/dashboard/inbox",
  ANNOUNCEMENT_PUBLISHED: "/dashboard/updates",
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
