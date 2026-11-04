"use server";

import { revalidatePath } from "next/cache";
import { RedirectType, redirect } from "next/navigation";
import { serverApiRequest } from "@/lib/api/server-api";
import { safeNextPath } from "@/domains/auth/helpers/safe-next-path";
import {
  FEED_KINDS,
  type FeedKind,
} from "@/domains/notifications/helpers/notification-feed";

/** Whether the server wrote the read (false: the row is still unread). */
export type ReadResult = { written: boolean };

/**
 * Marks a row of the bell read (09 § 6), then draws the whole player's
 * layout again — the bell's badge, the left rail's and the list, the same
 * set read in the same request — and, for a row that leads elsewhere, goes
 * there (`href`, a new entry, or in place of the address with `replace`),
 * all in one round trip. The backend checks that the row is the player's;
 * `href` is the app's own path or nothing.
 *
 * Not written (backend down, row gone): nothing redrawn and no redirect —
 * the caller leads on by itself, the row stays unread.
 */
export async function markNotificationRead(
  id: string,
  href: string | null,
  replace = false,
): Promise<ReadResult> {
  try {
    await serverApiRequest(`/notifications/${encodeURIComponent(id)}/read`, {
      method: "PATCH",
    });
  } catch {
    return { written: false };
  }
  revalidatePath("/", "layout");
  const target = safeNextPath(href);
  // Outside the try: a redirect is thrown.
  if (target)
    redirect(target, replace ? RedirectType.replace : RedirectType.push);
  return { written: true };
}

/**
 * « Tout marquer comme lu », within the kind shown (an admin's technical
 * alerts alone), then the layout drawn again, badge and list together.
 */
export async function markAllNotificationsRead(
  kind: FeedKind,
): Promise<ReadResult> {
  const category = FEED_KINDS.includes(kind) && kind !== "all" ? kind : null;
  try {
    await serverApiRequest(
      `/notifications/read-all${category ? `?category=${category}` : ""}`,
      { method: "POST" },
    );
  } catch {
    return { written: false };
  }
  revalidatePath("/", "layout");
  return { written: true };
}
