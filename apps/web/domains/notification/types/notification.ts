export type NotificationType =
  | "ROI_ALERT"
  | "MARKET_SUSPENSION"
  | "BRIER_ALERT"
  | "WEEKLY_REPORT"
  | "ETL_FAILURE"
  | "WEIGHT_ADJUSTMENT"
  | "XG_UNAVAILABLE_REPORT";

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
};

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
