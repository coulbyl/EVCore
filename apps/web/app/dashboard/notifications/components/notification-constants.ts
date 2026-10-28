import type { NotificationView } from "@/domains/notification/types/notification";

export type DayGroup = { day: string; items: NotificationView[] };

/** Les notifications d'un même jour, dans l'ordre reçu (du plus récent). */
export function groupByDay(notifications: NotificationView[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const n of notifications) {
    const day = new Date(n.createdAt).toDateString();
    const existing = groups.find((g) => g.day === day);
    if (existing) existing.items.push(n);
    else groups.push({ day, items: [n] });
  }
  return groups;
}

export type AgeUnit = "justNow" | "minutes" | "hours" | "days";

export function ageOf(createdAt: string): { unit: AgeUnit; count: number } {
  const minutes = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / 60_000,
  );
  if (minutes < 1) return { unit: "justNow", count: 0 };
  if (minutes < 60) return { unit: "minutes", count: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: "hours", count: hours };
  return { unit: "days", count: Math.floor(hours / 24) };
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/**
 * Aperçu en texte brut du corps HTML d'une annonce (sortie de l'éditeur
 * admin). Le corps n'était pas affiché du tout : il fallait ouvrir une
 * autre page pour savoir de quoi parlait l'annonce (revue UX du
 * 2026-10-27, Notifications P2-6).
 */
export function plainTextPreview(html: string): string {
  return html
    .replace(/<(br|\/p|\/li|\/h[1-6])\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Où mène une notification : l'annonce elle-même, ou la conversation. */
export function notificationHref(n: NotificationView): string | null {
  if (n.type === "SUPPORT_MESSAGE") return "/dashboard/inbox";
  if (n.type === "SLIPS_SETTLED_DIGEST") return "/dashboard/bet-slips";
  if (n.type === "ANNOUNCEMENT_PUBLISHED") {
    const id = n.payload?.announcementId;
    return typeof id === "string"
      ? `/dashboard/updates?id=${encodeURIComponent(id)}`
      : "/dashboard/updates";
  }
  return null;
}
