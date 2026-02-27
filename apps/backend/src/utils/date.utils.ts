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

export function eplSeasonFallbackStartDate(year: number): Date {
  return parseIsoDate(`${year}-08-01T00:00:00Z`);
}

export function eplSeasonFallbackEndDate(year: number): Date {
  return parseIsoDate(`${year + 1}-05-31T00:00:00Z`);
}

export function oneDayWindow(date: Date): { from: Date; to: Date } {
  return {
    from: addDays(date, -1),
    to: addDays(date, 1),
  };
}
