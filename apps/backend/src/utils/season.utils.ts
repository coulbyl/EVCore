export function seasonNameFromYear(year: number): string {
  return `${year}-${String(year + 1).slice(-2)}`;
}
