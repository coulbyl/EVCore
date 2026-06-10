import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { MlModelVersion } from '@evcore/db';
import { BULLMQ_QUEUES } from '@/config/etl.constants';
import { createLogger } from '@utils/logger';
import { NotificationService } from '@modules/notification/notification.service';
import { MlRepository } from './ml.repository';
import {
  ML_MIN_BRIER_IMPROVEMENT,
  ML_RETRAIN_MIN_NEW_BETS,
  ML_SEGMENTS,
  ML_TRAINING_JOB_OPTIONS,
  type MlSegment,
  type MlTrainingJobData,
  type MlTrainingJobStatus,
} from './ml.constants';

const logger = createLogger('ml-service');

type TriggerResult = { jobId: string };

@Injectable()
export class MlService {
  constructor(
    private readonly repo: MlRepository,
    private readonly notifications: NotificationService,
    @InjectQueue(BULLMQ_QUEUES.ML_TRAINING)
    private readonly queue: Queue<MlTrainingJobData>,
  ) {}

  async triggerTraining(
    segment: MlSegment,
    triggeredBy: string,
  ): Promise<TriggerResult> {
    const job = await this.queue.add(
      'train',
      { segment, triggeredBy },
      ML_TRAINING_JOB_OPTIONS,
    );
    return { jobId: job.id ?? '' };
  }

  async getTrainingJobStatus(jobId: string): Promise<MlTrainingJobStatus> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`ML training job not found: ${jobId}`);
    }

    return {
      id: job.id ?? jobId,
      name: job.name,
      state: await job.getState(),
      failedReason: job.failedReason ?? null,
      returnvalue: job.returnvalue ?? null,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn ?? null,
      finishedOn: job.finishedOn ?? null,
    };
  }

  async getActiveModel(segment: string): Promise<MlModelVersion | null> {
    return this.repo.findActive(segment);
  }

  async listModels(): Promise<MlModelVersion[]> {
    return this.repo.findAll();
  }

  async activateModel(id: string): Promise<MlModelVersion> {
    const model = await this.repo.activate(id);
    const metrics = model.metrics as Record<string, number>;
    await this.notifications.sendMlModelActivatedAlert({
      versionId: model.id,
      segment: model.segment,
      algorithm: model.algorithm,
      brierScore: metrics['brierScore'] ?? 0,
      calibrationError: metrics['calibrationError'] ?? 0,
      roiSimulated: metrics['roiShadow'] ?? 0,
      isRollback: false,
    });
    return model;
  }

  async rollbackModel(id: string): Promise<MlModelVersion> {
    const previous = await this.repo.rollback(id);
    await this.notifications.sendMlModelActivatedAlert({
      versionId: previous.id,
      segment: previous.segment,
      algorithm: previous.algorithm,
      brierScore: 0,
      calibrationError: 0,
      roiSimulated: 0,
      isRollback: true,
      rolledBackVersionId: id,
    });
    return previous;
  }

  async autoSwitchIfImproved(result: {
    version_id: string;
    segment: string;
    algorithm: string;
    brier_score: number;
    calibration_error: number;
    roi_simulated: number;
    sample_size: number;
  }): Promise<void> {
    const current = await this.repo.findActive(result.segment);

    const currentBrier = current
      ? ((current.metrics as Record<string, number>)['brierScore'] ?? 1)
      : 1;

    const improvement = (currentBrier - result.brier_score) / currentBrier;
    if (improvement < ML_MIN_BRIER_IMPROVEMENT) {
      logger.info(
        { segment: result.segment, improvement: improvement.toFixed(4) },
        'ML auto-switch skipped — insufficient Brier improvement',
      );
      return;
    }

    const cooldown = await this.repo.isCooldownActive(result.segment);
    if (cooldown) {
      logger.info(
        { segment: result.segment },
        'ML auto-switch skipped — cooldown active',
      );
      return;
    }

    const activated = await this.repo.activate(result.version_id);
    const metrics = activated.metrics as Record<string, number>;
    logger.info(
      {
        segment: result.segment,
        versionId: result.version_id,
        improvement: improvement.toFixed(4),
      },
      'ML model auto-switched',
    );
    await this.notifications.sendMlModelActivatedAlert({
      versionId: activated.id,
      segment: activated.segment,
      algorithm: activated.algorithm,
      brierScore: metrics['brierScore'] ?? result.brier_score,
      calibrationError: metrics['calibrationError'] ?? result.calibration_error,
      roiSimulated: metrics['roiShadow'] ?? result.roi_simulated,
      isRollback: false,
    });
  }

  async triggerRetrainIfNeeded(
    triggeredBy: string,
  ): Promise<{ queued: number }> {
    const lastCreated = await this.repo.findLastCreatedAt('ALL');
    const since = lastCreated ?? new Date(0);
    const newBets = await this.repo.countNewBetsSince(since);

    if (newBets < ML_RETRAIN_MIN_NEW_BETS) {
      logger.info(
        { newBets, threshold: ML_RETRAIN_MIN_NEW_BETS },
        'ML retrain skipped — not enough new settled bets',
      );
      return { queued: 0 };
    }

    let queued = 0;
    for (const segment of ML_SEGMENTS) {
      await this.queue.add(
        'train',
        { segment, triggeredBy },
        ML_TRAINING_JOB_OPTIONS,
      );
      queued++;
    }
    logger.info({ queued, newBets }, 'ML retrain jobs queued');
    return { queued };
  }
}
