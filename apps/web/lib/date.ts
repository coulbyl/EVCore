import { format, isValid, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

function parseDateValue(value: string): Date | null {
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

/** "2026-04-11" */
export function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
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
