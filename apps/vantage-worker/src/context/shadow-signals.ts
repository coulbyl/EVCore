import type { ShadowPrediction } from "./types";

// Pure parsers over `ModelRun.features` (a Prisma `Json` column) — internal
// DB data, not an external ETL boundary, so a light runtime type guard is
// enough here (CLAUDE.md reserves Zod for external/system-boundary data).
// Both shapes degrade to `null`/empty on anything unexpected rather than
// throwing — a shadow signal that's absent or malformed just means VANTAGE
// reasons without it, same as any other optional context field.

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** A 0-100 split with a leg at exactly 0 or 100 isn't a real assessment —
 * no professional fixture has zero chance for one side. Confirmed as a
 * systemic upstream data issue rather than a genuine independent opinion:
 * API-Football's `/predictions` returns the exact degenerate pattern
 * `home:50/draw:50/away:0` with `poisson:100/0` on 179 of 2 809 fixtures
 * (2026-08-31 audit) — VANTAGE was citing it as justification for DRAW
 * picks that lost 8 times out of 9 (Real Madrid 4-0 Malaga, Barcelona 5-2
 * Rayo Vallecano among them), overriding its own, saner internal
 * probability (13.7%/23.9% draw on those two) with a broken "second
 * opinion". Reject rather than pass through — same fails-closed contract
 * as a malformed payload. */
function isPlausibleSplit(...values: number[]): boolean {
  return values.every((v) => v > 0 && v < 100);
}

/** `ModelRun.features.shadow_predictions` — API-Football's own
 * `/predictions` endpoint, ingested as a genuinely independent second
 * forecaster. See ShadowPrediction's doc comment in types.ts. */
export function extractShadowPrediction(features: unknown): ShadowPrediction {
  if (!isRecord(features)) return null;
  const raw = features["shadow_predictions"];
  if (!isRecord(raw)) return null;
  const percent = raw["percent"];
  const poisson = raw["poisson"];
  if (!isRecord(percent) || !isRecord(poisson)) return null;
  const { home: homePercent, draw: drawPercent, away: awayPercent } = percent;
  const { home: poissonHome, away: poissonAway } = poisson;
  if (
    !isFiniteNumber(homePercent) ||
    !isFiniteNumber(drawPercent) ||
    !isFiniteNumber(awayPercent) ||
    !isFiniteNumber(poissonHome) ||
    !isFiniteNumber(poissonAway)
  ) {
    return null;
  }
  if (
    !isPlausibleSplit(homePercent, drawPercent, awayPercent) ||
    !isPlausibleSplit(poissonHome, poissonAway)
  ) {
    return null;
  }
  const winnerName = raw["winnerName"];
  const conflict = raw["conflict"];
  return {
    homePercent,
    drawPercent,
    awayPercent,
    poissonHome,
    poissonAway,
    winnerName: typeof winnerName === "string" ? winnerName : null,
    conflict: conflict === true,
  };
}
