import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createLogger } from '@utils/logger';

// MlShadowFeatures is the exchange contract between NestJS and the Python
// ml-worker. Source of truth lives in analysis-core to prevent drift.
import type { MlShadowFeatures } from '@evcore/analysis-core';
export type { MlShadowFeatures };

export type MlShadowResult = {
  corrected_probability: number | null;
  model_found: boolean;
};

const ML_INFER_TIMEOUT_MS = 500;
// Reload deserializes model files (joblib) — allow more than the infer budget.
const ML_RELOAD_TIMEOUT_MS = 5000;
const logger = createLogger('ml-inference-service');

@Injectable()
export class MlInferenceService {
  private readonly mlWorkerUrl: string;

  constructor(config: ConfigService) {
    this.mlWorkerUrl = config.get<string>(
      'ML_WORKER_URL',
      'http://ml-worker:8000',
    );
  }

  async predictShadowCorrection(
    segment: string,
    features: MlShadowFeatures,
  ): Promise<MlShadowResult | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ML_INFER_TIMEOUT_MS);
      const res = await fetch(`${this.mlWorkerUrl}/infer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment, features }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!res.ok) return null;
      return (await res.json()) as MlShadowResult;
    } catch (err) {
      logger.warn({ segment, err }, 'ML shadow inference skipped');
      return null;
    }
  }

  // Ask the ml-worker to re-sync its in-memory models with ml_model_version.
  // Best-effort: a failure is logged but never blocks the activation itself —
  // the worker also re-syncs at startup, so the DB state remains authoritative.
  async requestReload(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        ML_RELOAD_TIMEOUT_MS,
      );
      const res = await fetch(`${this.mlWorkerUrl}/reload`, {
        method: 'POST',
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!res.ok) {
        logger.warn({ status: res.status }, 'ML worker reload failed');
        return false;
      }
      return true;
    } catch (err) {
      logger.warn({ err }, 'ML worker reload unreachable');
      return false;
    }
  }
}
