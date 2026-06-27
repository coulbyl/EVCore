// Coerce a possibly-Decimal/Prisma numeric into a JS number.
export function asNumber(value: unknown): number {
  return Number(value);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
