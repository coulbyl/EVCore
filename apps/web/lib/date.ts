import {
  addDays,
  format,
  isSameDay,
  isValid,
  isYesterday,
  parseISO,
  subDays,
} from "date-fns";
import { fr } from "date-fns/locale";

function parseDateValue(value: string): Date | null {
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

/** "2026-04-11" */
export function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** Date → "2026-04-11" */
export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** "2026-04-11" — N jours avant aujourd'hui */
export function daysAgoIso(n: number): string {
  return format(subDays(new Date(), n), "yyyy-MM-dd");
}

/** "2026-04-11" — N jours après aujourd'hui */
export function daysAheadIso(n: number): string {
  return format(addDays(new Date(), n), "yyyy-MM-dd");
}

/** "2026-04-11T18:30:00Z" → Date */
export function isoToDate(iso: string): Date {
  const parsed = parseDateValue(iso);
  return parsed ?? new Date(NaN);
}

/** "2026-04-11T18:30:00Z" → "18:30" */
export function formatTime(iso: string): string {
  const parsed = parseDateValue(iso);
  if (!parsed) return iso;
  return format(parsed, "HH:mm");
}

/** "2026-04-11T18:30:00Z" → "11 avr." */
export function formatDate(iso: string): string {
  const parsed = parseDateValue(iso);
  if (!parsed) return iso;
  return format(parsed, "d MMM", { locale: fr });
}

/** "2026-04-11T18:30:00Z" → "11 avril 2026" */
export function formatDateLong(iso: string): string {
  const parsed = parseDateValue(iso);
  if (!parsed) return iso;
  return format(parsed, "d MMMM yyyy", { locale: fr });
}

/** "2026-04-11T18:30:00Z" → "11/04/26" */
export function formatDateShort(iso: string): string {
  const parsed = parseDateValue(iso);
  if (!parsed) return iso;
  return format(parsed, "dd/MM/yy", { locale: fr });
}

/** "2026-04-11T18:30:00Z" → "11/04/2026 18:30" */
export function formatDateTime(iso: string): string {
  const parsed = parseDateValue(iso);
  if (!parsed) return iso;
  return format(parsed, "dd/MM/yyyy HH:mm", { locale: fr });
}

/** "2026-04-11T18:30:00Z" → "à l'instant" / "il y a 5 min" / "il y a 2h" /
 * "11/04" (falls back to a short date past 24h) — compact form for chat/feed UIs. */
export function formatRelativeTime(iso: string): string {
  const parsed = parseDateValue(iso);
  if (!parsed) return iso;

  const diffMin = Math.round((Date.now() - parsed.getTime()) / 60_000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  return format(parsed, "dd/MM", { locale: fr });
}

/** "2026-04-11T18:30:00Z" → "Aujourd'hui" / "Hier" / "11 avril 2026" —
 * day-divider label for chat/feed UIs. */
export function formatDayLabel(iso: string): string {
  const parsed = parseDateValue(iso);
  if (!parsed) return iso;
  if (isSameDay(parsed, new Date())) return "Aujourd'hui";
  if (isYesterday(parsed)) return "Hier";
  return format(parsed, "d MMMM yyyy", { locale: fr });
}
