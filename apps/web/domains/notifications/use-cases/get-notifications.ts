import { cache } from "react";
import { serverApiRequest } from "@/lib/api/server-api";
import {
  feedQuery,
  type FeedFilter,
  type NotificationCategory,
} from "../helpers/notification-feed";

/** Mirror of the backend's NotificationView, the fields the list shows. */
export type PlayerNotification = {
  id: string;
  type:
    | "MORNING_BRIEF"
    | "WEEKLY_STATEMENT"
    | "FOLLOWED_SETTLED"
    | "SUPPORT_MESSAGE"
    | "ANNOUNCEMENT_PUBLISHED"
    | string;
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
  category: NotificationCategory;
};

/**
 * The bell's list, most recent first (09 § 6), filtered by the server (read
 * status, kind), read once per request.
 */
export const getNotifications = cache(
  (
    status: FeedFilter["status"],
    kind: FeedFilter["kind"],
    limit: number,
  ): Promise<{ data: PlayerNotification[]; total: number }> =>
    serverApiRequest(`/notifications?${feedQuery({ status, kind }, limit)}`),
);

/**
 * The bell's badge: unread notifications, shared by the band and the left
 * rail within a request. It only seeds the tab (use-unread-count.ts). A
 * failed read is null — no badge rather than an error, and never a « 0 »
 * that would hide a live count.
 */
export const getUnreadCount = cache(async (): Promise<number | null> => {
  try {
    const { count } = await serverApiRequest<{ count: number }>(
      "/notifications/unread-count",
    );
    return count;
  } catch {
    return null;
  }
});
