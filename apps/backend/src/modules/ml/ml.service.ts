import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { MlModelVersion } from '@evcore/db';
import {
  BULLMQ_DEFAULT_JOB_OPTIONS,
  BULLMQ_QUEUES,
} from '@/config/etl.constants';
import { MlRepository } from './ml.repository';
import type { MlSegment, MlTrainingJobData } from './ml.constants';

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
      BULLMQ_DEFAULT_JOB_OPTIONS,
    );
    return { jobId: job.id ?? '' };
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
