import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { createLogger } from '@utils/logger';
import { BULLMQ_QUEUES } from '@config/etl.constants';
import { SubscriptionMatchingService } from '../../subscriptions/subscription-matching.service';
import { NotificationService } from '../../notification/notification.service';
import { notifyOnWorkerFailure } from './etl-worker.utils';

export type SubscriptionMatchingJobData = Record<string, never>;

const logger = createLogger('subscription-matching-worker');

@Injectable()
@Processor(BULLMQ_QUEUES.SUBSCRIPTION_MATCHING)
export class SubscriptionMatchingWorker extends WorkerHost {
  @Inject(NotificationService)
  private notification!: NotificationService;

  constructor(
    private readonly subscriptionMatchingService: SubscriptionMatchingService,
  ) {
    super();
  }

  async process(_job: Job<SubscriptionMatchingJobData>): Promise<void> {
    await this.subscriptionMatchingService.runDailyMatching();
  }

  @OnWorkerEvent('failed')
  onFailed(
    job: Job<SubscriptionMatchingJobData> | undefined,
    error: Error,
  ): void {
    notifyOnWorkerFailure({
      notification: this.notification,
      queueName: BULLMQ_QUEUES.SUBSCRIPTION_MATCHING,
      job,
      error,
      logger,
    });
  }
}
