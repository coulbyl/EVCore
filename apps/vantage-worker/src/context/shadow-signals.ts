import type { ShadowPrediction, ShadowMlSignal } from "./types";

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

/** `ModelRun.features.shadow_ml_by_channel` — restricted to DOMINANT/VALUE
 * only. See ShadowMlSignal's doc comment in types.ts for why the other 5
 * segments (GOALS/TEAM_TOTAL/CLEAN_SHEET/WIN_EITHER_HALF/BTTS) are excluded:
 * a 2026-08-30 calibration audit found the correction makes them worse, not
 * better. */
const CALIBRATION_SAFE_ML_CHANNELS = ["DOMINANT", "VALUE"] as const;

export function extractShadowMl(features: unknown): ShadowMlSignal[] {
  if (!isRecord(features)) return [];
  const raw = features["shadow_ml_by_channel"];
  if (!isRecord(raw)) return [];

  const results: ShadowMlSignal[] = [];
  for (const channel of CALIBRATION_SAFE_ML_CHANNELS) {
    const entry = raw[channel];
    if (!isRecord(entry)) continue;
    const { correctedP, edgeDelta } = entry;
    if (!isFiniteNumber(correctedP) || !isFiniteNumber(edgeDelta)) continue;
    results.push({ channel, correctedP, edgeDelta });
  }
  return results;
}
