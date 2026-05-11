import { Controller, Param, Post, HttpCode } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  BULLMQ_QUEUES,
  BULLMQ_DEFAULT_JOB_OPTIONS,
} from '@config/etl.constants';
import type { BettingEngineAnalysisJobData } from '../etl/workers/betting-engine-analysis.worker';

@Controller('betting-engine')
export class BettingEngineController {
  constructor(
    @InjectQueue(BULLMQ_QUEUES.BETTING_ENGINE)
    private readonly bettingEngineQueue: Queue<BettingEngineAnalysisJobData>,
  ) {}

  @Post('analyze/date/:date')
  @HttpCode(200)
  async analyzeByDate(
    @Param('date') date: string,
  ): Promise<{ queued: boolean }> {
    await this.bettingEngineQueue.add(
      'analyze',
      { date },
      BULLMQ_DEFAULT_JOB_OPTIONS,
    );
    return { queued: true };
  }
}
