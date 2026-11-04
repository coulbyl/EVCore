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

/**
 * Where a row leads (09 § 6). A technical alert leads to the admin screen
 * that shows it; an announcement, and the rest, show in full here (null).
 */
export function hrefOf(type: string): string | null {
  switch (type) {
    case "MORNING_BRIEF":
      return "/today";
    case "WEEKLY_STATEMENT":
      return "/results/week";
    case "FOLLOWED_SETTLED":
      return "/me?tab=settled";
    case "SUPPORT_MESSAGE":
      return "/me/messages";
    case "ETL_FAILURE":
    case "XG_UNAVAILABLE_REPORT":
      return "/admin/exploitation";
    case "ROI_ALERT":
    case "MARKET_SUSPENSION":
    case "BRIER_ALERT":
    case "WEEKLY_REPORT":
    case "WEIGHT_ADJUSTMENT":
    case "ML_MODEL_ACTIVATED":
    case "ML_MODEL_MISSING":
      return "/admin/engine";
    default:
      return null;
  }
}

/** The badge's count and when the server (or this tab) read it. */
export type UnreadReading = { count: number; asOf: number };

/**
 * Whether a reading replaces the one shown. A screen restored from the
 * router's cache (back, forward) carries the count of when it was drawn:
 * older than the one shown, it is ignored rather than bringing back a
 * notification already read.
 */
export function newerReading(
  shown: UnreadReading | null,
  next: UnreadReading,
): UnreadReading {
  return shown === null || next.asOf >= shown.asOf ? next : shown;
}
