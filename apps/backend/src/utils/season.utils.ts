// Leagues whose season starts in the second half of the year (Jul-Dec) run
// into the following calendar year (e.g. "2023-24"). Leagues starting in the
// first half (Jan-Jun) complete within a single calendar year (e.g. "2023").
export function seasonNameFromYear(
  year: number,
  seasonStartMonth: number,
): string {
  return seasonStartMonth >= 6
    ? `${year}-${String(year + 1).slice(-2)}`
    : `${year}`;
}
