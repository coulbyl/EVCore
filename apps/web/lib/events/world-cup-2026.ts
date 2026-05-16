export const WC2026 = {
  start: new Date("2026-06-11T00:00:00Z"),
  end: new Date("2026-07-19T23:59:59Z"),
  code: "WC26",
} as const;

export function isWC2026Active(now = new Date()): boolean {
  return now >= WC2026.start && now <= WC2026.end;
}

export function isWC2026Countdown(now = new Date()): boolean {
  const thirtyDaysBefore = new Date(WC2026.start.getTime() - 30 * 86_400_000);
  return now >= thirtyDaysBefore && now < WC2026.start;
}

export function daysUntilWC2026(now = new Date()): number {
  return Math.ceil((WC2026.start.getTime() - now.getTime()) / 86_400_000);
}
