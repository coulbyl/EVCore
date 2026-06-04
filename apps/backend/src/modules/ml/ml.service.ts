import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { MlModelVersion } from '@evcore/db';
import { BULLMQ_QUEUES } from '@/config/etl.constants';
import { MlRepository } from './ml.repository';
import {
  ML_TRAINING_JOB_OPTIONS,
  type MlSegment,
  type MlTrainingJobData,
  type MlTrainingJobStatus,
} from './ml.constants';

type TriggerResult = { jobId: string };

@Injectable()
export class MlService {
  constructor(
    private readonly repo: MlRepository,
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
    return this.repo.activate(id);
  }
}
