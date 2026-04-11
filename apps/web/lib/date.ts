import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

/** "2026-04-11" */
export function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** "2026-04-11T18:30:00Z" → Date */
export function isoToDate(iso: string): Date {
  return parseISO(iso);
}

/** "2026-04-11T18:30:00Z" → "18:30" */
export function formatTime(iso: string): string {
  return format(parseISO(iso), "HH:mm");
}

/** "2026-04-11T18:30:00Z" → "11 avr." */
export function formatDate(iso: string): string {
  return format(parseISO(iso), "d MMM", { locale: fr });
}

/** "2026-04-11T18:30:00Z" → "11 avril 2026" */
export function formatDateLong(iso: string): string {
  return format(parseISO(iso), "d MMMM yyyy", { locale: fr });
}
