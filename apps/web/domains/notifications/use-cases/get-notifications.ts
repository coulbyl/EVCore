import { cache } from "react";
import { serverApiRequest } from "@/lib/api/server-api";

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

/** The bell's list, most recent first (09 § 6), read once per request. */
export const getNotifications = cache(
  (limit: number): Promise<{ data: PlayerNotification[]; total: number }> =>
    serverApiRequest(`/notifications?limit=${limit}`),
);

/**
 * The bell's badge: unread notifications. Shared by the band and the left
 * rail within a request; a failed read shows no badge rather than an error.
 */
export const getUnreadCount = cache(async (): Promise<number> => {
  try {
    const { count } = await serverApiRequest<{ count: number }>(
      "/notifications/unread-count",
    );
    return count;
  } catch {
    return 0;
  }
});
