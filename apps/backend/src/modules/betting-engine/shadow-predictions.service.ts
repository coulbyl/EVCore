import { Injectable } from '@nestjs/common';
import { ApiFootballClient } from '../etl/api-football.client';
import { ApiFootballPredictionsResponseSchema } from '../etl/schemas/predictions.schema';
import { ETL_CONSTANTS } from '@config/etl.constants';
import { createLogger } from '@utils/logger';

// API-Football /predictions as an independent second model — SHADOW ONLY.
// The payload is stored in ModelRun.features.shadow_predictions and compared
// to our λ direction; it never enters the scoring loop (the deterministic
// model stays the single primary source). Best-effort: any failure → null.

export type ShadowPrediction = {
  winnerName: string | null;
  // 1X2 percentages from their prediction model (0–100).
  percent: { home: number; draw: number; away: number };
  // Their Poisson comparison home vs away strength (0–100, sums ~100).
  poisson: { home: number; away: number };
};

const logger = createLogger('shadow-predictions-service');

@Injectable()
export class ShadowPredictionsService {
  constructor(private readonly apiFootball: ApiFootballClient) {}

  async fetchShadowPrediction(
    externalId: number,
  ): Promise<ShadowPrediction | null> {
    const url = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/predictions?fixture=${externalId}`;

    try {
      const result = await this.apiFootball.fetchJson(url);
      const res = result.response;
      if (res === null || res.status < 200 || res.status >= 300) {
        logger.warn(
          { externalId, status: res?.status ?? null },
          'Predictions fetch failed — shadow value null',
        );
        return null;
      }

      const parsed = ApiFootballPredictionsResponseSchema.safeParse(res.body);
      if (!parsed.success) {
        logger.warn(
          { externalId, issues: parsed.error.issues },
          'Predictions Zod validation failed — shadow value null',
        );
        return null;
      }

      const entry = parsed.data.response[0];
      if (!entry) return null;

      return {
        winnerName: entry.predictions.winner?.name ?? null,
        percent: entry.predictions.percent,
        poisson: entry.comparison.poisson_distribution,
      };
    } catch (error) {
      logger.warn(
        {
          externalId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Predictions fetch threw — shadow value null',
      );
      return null;
    }
  }
}

// Directional conflict: their Poisson comparison and our λ point to opposite
// teams. The single strongest corrupted-input tell (Argentina case: their
// poisson 100/0 for home, our λ favored away).
export function hasDirectionalConflict(
  prediction: ShadowPrediction,
  lambda: { home: number; away: number },
): boolean {
  const ourDirection = Math.sign(lambda.home - lambda.away);
  const theirDirection = Math.sign(
    prediction.poisson.home - prediction.poisson.away,
  );
  return (
    ourDirection !== 0 &&
    theirDirection !== 0 &&
    ourDirection !== theirDirection
  );
}
