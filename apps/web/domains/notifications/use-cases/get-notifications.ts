import { cache } from "react";
import { serverApiRequest } from "@/lib/api/server-api";
import {
  feedQuery,
  type FeedFilter,
  type UnreadReading,
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
 * The bell's badge: unread notifications, and when they were read (the
 * tab keeps the newest reading, use-unread-count.ts). Shared by the band
 * and the left rail within a request; a failed read is null — no badge
 * rather than an error, and never a « 0 » that would hide a live count.
 */
export const getUnreadCount = cache(async (): Promise<UnreadReading | null> => {
  const asOf = Date.now();
  try {
    const { count } = await serverApiRequest<{ count: number }>(
      "/notifications/unread-count",
    );
    return { count, asOf };
  } catch {
    return null;
  }
});
