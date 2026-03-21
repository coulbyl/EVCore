import { addDays, isValid, parseISO } from 'date-fns';

export function parseIsoDate(value: string): Date {
  const date = parseISO(value);
  if (!isValid(date)) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return date;
}

export function parseUnderstatDatetimeUtc(value: string): Date {
  // Understat format: "YYYY-MM-DD HH:mm:ss" (treated as UTC)
  return parseIsoDate(value.replace(' ', 'T') + 'Z');
}

export function seasonFallbackStartDate(year: number): Date {
  return parseIsoDate(`${year}-08-01T00:00:00Z`);
}

export function seasonFallbackEndDate(year: number): Date {
  return parseIsoDate(`${year + 1}-05-31T00:00:00Z`);
}

export function oneDayWindow(date: Date): { from: Date; to: Date } {
  return {
    from: addDays(date, -1),
    to: addDays(date, 1),
  };
}

// Returns the start of tomorrow (00:00:00 UTC).
export function tomorrowUtc(): Date {
  const d = addDays(new Date(), 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Returns YYYY-MM-DD string from a Date (UTC).
export function formatDateUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

// Returns HH:mm (UTC).
export function formatTimeUtc(date: Date): string {
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Returns HH:mm:ss (UTC).
export function formatTimeWithSecondsUtc(date: Date): string {
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// Returns the starting year of the season currently in progress for a competition
// whose new season starts on `seasonStartMonth` (0-indexed, e.g. 7 = August).
// If the current UTC month is before the start month, the season started last year.
// Examples with seasonStartMonth=7: March 2026 → 2025, September 2026 → 2026.
export function currentSeason(
  seasonStartMonth: number,
  now: Date = new Date(),
): number {
  if (
    !Number.isInteger(seasonStartMonth) ||
    seasonStartMonth < 0 ||
    seasonStartMonth > 11
  ) {
    throw new Error(`Invalid seasonStartMonth: ${seasonStartMonth}`);
  }

  return now.getUTCMonth() >= seasonStartMonth
    ? now.getUTCFullYear()
    : now.getUTCFullYear() - 1;
}

// Returns the last `count` season start-years in ascending order for a competition
// whose season starts on `seasonStartMonth` (0-indexed).
// Default count=3: [current-2, current-1, current].
export function activeSeasons(
  seasonStartMonth: number,
  count = 3,
  now: Date = new Date(),
): number[] {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`Invalid season count: ${count}`);
  }

  const current = currentSeason(seasonStartMonth, now);
  return Array.from({ length: count }, (_, i) => current - (count - 1 - i));
}
