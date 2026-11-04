import type { AdminSectionKey } from "@/components/scoreboard/shell/shell-constants";

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
 * Where a row leads (09 § 6), by its type (the player's and the technical
 * types never overlap). A technical alert leads to the admin screen that
 * shows it (`adminHref`: `adminSectionHref` from shell-constants); an
 * announcement, and the rest, show in full here (null).
 */
export function hrefOf(
  type: string,
  adminHref: (section: AdminSectionKey) => string,
): string | null {
  const section = ADMIN_SECTION_OF[type];
  return section ? adminHref(section) : (PLAYER_HREFS[type] ?? null);
}
