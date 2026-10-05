import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createLogger } from '@utils/logger';
import { formatDateUtc, tomorrowUtc } from '@utils/date.utils';
import { BULLMQ_QUEUES } from '@config/etl.constants';
import { BettingEngineService } from '../../betting-engine/betting-engine.service';
import { NotificationService } from '../../notification/notification.service';
import { CouponPriceGenerationService } from '../../coupon/coupon-price-generation.service';
import { notifyOnWorkerFailure } from './etl-worker.utils';

export type BettingEngineAnalysisJobData = { date?: string };

const logger = createLogger('betting-engine-analysis-worker');

@Processor(BULLMQ_QUEUES.BETTING_ENGINE)
export class BettingEngineAnalysisWorker extends WorkerHost {
  constructor(
    private readonly bettingEngineService: BettingEngineService,
    private readonly notification: NotificationService,
    private readonly couponPriceGeneration: CouponPriceGenerationService,
  ) {
    super();
  }

  async process(job: Job<BettingEngineAnalysisJobData>): Promise<void> {
    const date = job.data.date ?? formatDateUtc(tomorrowUtc());

    logger.info({ date }, 'Starting betting engine daily analysis');

    const result = await this.bettingEngineService.analyzeByDate(date);

    logger.info(result, 'Betting engine daily analysis complete');

    // The LLM coupon pipeline stays on its own scheduler in
    // apps/vantage-worker (VANTAGE_COUPON_CRON, 30 minutes after this cron's
    // 20:00 UTC default) — see docs/vantage-centric-redesign-2026-09-01.md
    // §9bis.
    //
    // The price composer is CHAINED here instead of getting its own cron, and
    // deliberately so: it reads the `evaluatedPicks` this very analysis just
    // wrote. A second cron would have to guess how long the analysis takes on
    // a heavy day, and would compose from an empty or half-written pool
    // whenever it guessed wrong. Chaining makes that race impossible.
    //
    // Only for tomorrow. The rolling-horizon pass (17:00 UTC, J+1..J+4)
    // also lands here, and the proposal keeps its first composition: until
    // 2026-10-05 the coupon was frozen by the J+4 run, 66.6 h before kickoff
    // on average (max 100.7 h) on that run's analysis odds, and settled at
    // prices nobody could take at kickoff (OVER 2.19 proposed, 1.73 at the
    // close). The J+1 passes (17:00 then 20:00) are the ones with same-day
    // and evening prices.
    //
    // Its failure must never fail the analysis: the analysis is what feeds
    // every channel, the coupon is one consumer among them.
    if (date !== formatDateUtc(tomorrowUtc())) {
      logger.info({ date }, 'Price composer skipped: not tomorrow');
      return;
    }
    try {
      const coupon = await this.couponPriceGeneration.generateForDate(
        new Date(`${date}T00:00:00.000Z`),
      );
      logger.info({ date, ...coupon }, 'Price composer pass complete');
    } catch (error) {
      logger.error({ date, err: error }, 'Price composer pass failed');
    }
  }

  @OnWorkerEvent('failed')
  onFailed(
    job: Job<BettingEngineAnalysisJobData> | undefined,
    error: Error,
  ): void {
    notifyOnWorkerFailure({
      notification: this.notification,
      queueName: BULLMQ_QUEUES.BETTING_ENGINE,
      job,
      error,
      logger,
    });
  }
}
