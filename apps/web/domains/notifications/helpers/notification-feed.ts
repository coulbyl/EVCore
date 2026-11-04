/**
 * What the Notifications screen filters on, kept in its address so a
 * filter survives a reload and « Voir plus »: the read status for everyone,
 * the kind for an admin (whose bell also holds the technical alerts). The
 * server filters (GET /notifications?status=&category=): a page filtered in
 * the browser would count what it does not show.
 */
export type FeedStatus = "all" | "unread" | "read";
export type FeedKind = "all" | "player" | "technical";

export type FeedFilter = { status: FeedStatus; kind: FeedKind };

export const FEED_STATUSES: readonly FeedStatus[] = ["all", "unread", "read"];
export const FEED_KINDS: readonly FeedKind[] = ["all", "player", "technical"];

/** The address's filter; anything unknown, and a player's kind, is « all ». */
export function parseFeedFilter(
  params: { status?: string; kind?: string },
  admin: boolean,
): FeedFilter {
  const status = FEED_STATUSES.find((s) => s === params.status) ?? "all";
  const kind = admin
    ? (FEED_KINDS.find((k) => k === params.kind) ?? "all")
    : "all";
  return { status, kind };
}

/** The backend's query for a filter (`category` is the kind). */
export function feedQuery(filter: FeedFilter, limit: number): string {
  const query = new URLSearchParams({ limit: String(limit) });
  if (filter.status !== "all") query.set("status", filter.status);
  if (filter.kind !== "all") query.set("category", filter.kind);
  return query.toString();
}

/** The screen's address for a filter, and the pages already shown. */
export function feedHref(filter: FeedFilter, more = 0): string {
  const query = new URLSearchParams();
  if (filter.status !== "all") query.set("status", filter.status);
  if (filter.kind !== "all") query.set("kind", filter.kind);
  if (more > 0) query.set("more", String(more));
  const search = query.toString();
  return search ? `/notifications?${search}` : "/notifications";
}

import type { AdminSectionKey } from "@/components/scoreboard/shell/shell-constants";

/** The backend's NotificationView.category: what a player's bell can hold, or not. */
export type NotificationCategory = "player" | "technical";

const PLAYER_HREFS: Partial<Record<string, string>> = {
  MORNING_BRIEF: "/today",
  WEEKLY_STATEMENT: "/results/week",
  FOLLOWED_SETTLED: "/me?tab=settled",
  SUPPORT_MESSAGE: "/me/messages",
};

/** The admin screen that shows a technical alert. */
const ADMIN_SECTION_OF: Partial<Record<string, AdminSectionKey>> = {
  ETL_FAILURE: "exploitation",
  XG_UNAVAILABLE_REPORT: "exploitation",
  ROI_ALERT: "engine",
  MARKET_SUSPENSION: "engine",
  BRIER_ALERT: "engine",
  WEEKLY_REPORT: "engine",
  WEIGHT_ADJUSTMENT: "engine",
  ML_MODEL_ACTIVATED: "engine",
  ML_MODEL_MISSING: "engine",
};

/**
 * Where a row leads (09 § 6). A technical alert leads to the admin screen
 * that shows it (`adminHref`, from ADMIN_SECTIONS); an announcement, and
 * the rest, show in full here (null).
 */
export function hrefOf(
  notification: { type: string; category: NotificationCategory },
  adminHref: (section: AdminSectionKey) => string,
): string | null {
  if (notification.category === "technical") {
    const section = ADMIN_SECTION_OF[notification.type];
    return section ? adminHref(section) : null;
  }
  return PLAYER_HREFS[notification.type] ?? null;
}

/** The badge's count and when this browser read it (Date.now()). */
export type UnreadReading = { count: number; asOf: number };

/**
 * Whether a reading replaces the one shown, both read on this browser's
 * clock: an answer that left before the shown one arrived after it is
 * ignored rather than bringing back a notification already read.
 */
export function newerReading(
  shown: UnreadReading | null,
  next: UnreadReading,
): UnreadReading {
  return shown === null || next.asOf >= shown.asOf ? next : shown;
}
