import { Injectable } from '@nestjs/common';
import {
  OnQueueEvent,
  QueueEventsHost,
  QueueEventsListener,
} from '@nestjs/bullmq';
import { BULLMQ_QUEUES } from '@/config/etl.constants';
import { createLogger } from '@utils/logger';
import { MlService } from './ml.service';

const logger = createLogger('ml-training-events');

type TrainingCompletedResult = {
  status: string;
  version_id?: string;
  segment?: string;
  algorithm?: string;
  brier_score?: number;
  calibration_error?: number;
  roi_simulated?: number;
  sample_size?: number;
};

@Injectable()
@QueueEventsListener(BULLMQ_QUEUES.ML_TRAINING)
export class MlTrainingEventsListener extends QueueEventsHost {
  constructor(private readonly ml: MlService) {
    super();
  }

  @OnQueueEvent('completed')
  async onTrainingCompleted({
    returnvalue,
  }: {
    jobId: string;
    returnvalue: string;
  }): Promise<void> {
    let result: TrainingCompletedResult;
    try {
      result = JSON.parse(returnvalue) as TrainingCompletedResult;
    } catch {
      return;
    }

    if (
      result.status !== 'done' ||
      !result.version_id ||
      !result.segment ||
      !result.algorithm ||
      result.brier_score == null
    ) {
      return;
    }

    logger.info(
      {
        segment: result.segment,
        versionId: result.version_id,
        brierScore: result.brier_score,
      },
      'ML training completed — evaluating auto-switch',
    );

    await this.ml.autoSwitchIfImproved({
      version_id: result.version_id,
      segment: result.segment,
      algorithm: result.algorithm,
      brier_score: result.brier_score,
      calibration_error: result.calibration_error ?? 0,
      roi_simulated: result.roi_simulated ?? 0,
      sample_size: result.sample_size ?? 0,
    });
  }
}
