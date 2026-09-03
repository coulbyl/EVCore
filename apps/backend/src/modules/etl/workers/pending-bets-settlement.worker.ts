import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { FixtureStatus } from '@evcore/db';
import { createLogger } from '@utils/logger';
import { ApiFootballClient } from '../api-football.client';
import { BULLMQ_QUEUES, ETL_CONSTANTS } from '@config/etl.constants';
import {
  ApiFootballFixturesResponseSchema,
  type ApiFootballFixture,
  type ApiFootballStatus,
} from '../schemas/fixture.schema';
import { FixtureService } from '../../fixture/fixture.service';
import { BettingEngineService } from '../../betting-engine/betting-engine.service';
import { CouponSettlementService } from '../../coupon/coupon-settlement.service';
import { NotificationService } from '../../notification/notification.service';
import { AdjustmentService } from '../../adjustment/adjustment.service';
import { notifyOnWorkerFailure } from './etl-worker.utils';

export type PendingBetsSettlementJobData = Record<string, never>;

const logger = createLogger('pending-bets-settlement-worker');

@Injectable()
@Processor(BULLMQ_QUEUES.PENDING_BETS_SETTLEMENT)
export class PendingBetsSettlementWorker extends WorkerHost {
  @Inject(NotificationService)
  private notification!: NotificationService;

  @Inject(ApiFootballClient)
  private apiFootball!: ApiFootballClient;

  @Inject(CouponSettlementService)
  private couponSettlement!: CouponSettlementService;

  constructor(
    private readonly fixtureService: FixtureService,
    private readonly bettingEngineService: BettingEngineService,
    private readonly adjustmentService: AdjustmentService,
  ) {
    super();
  }

  async process(_job: Job<PendingBetsSettlementJobData>): Promise<void> {
    const fixtures = await this.fixtureService.findPendingSettlementFixtures(
      new Date(),
    );

    logger.info(
      { fixtureCount: fixtures.length },
      'Starting pending bets settlement sync',
    );

    let finishedFixtures = 0;
    let settledBets = 0;
    let failedFixtures = 0;
    let skippedFixtures = 0;

    for (const fixture of fixtures) {
      try {
        const url = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/fixtures?id=${fixture.externalId}`;
        const curlResult = await this.apiFootball.fetchJson(url);

        if (curlResult.response === null) {
          skippedFixtures++;
          logger.warn(
            { externalId: fixture.externalId },
            'Transient network error while fetching fixture settlement state — skipping fixture',
          );
          continue;
        }
        const res = curlResult.response;

        if (res.status < 200 || res.status >= 300) {
          failedFixtures++;
          logger.error(
            { externalId: fixture.externalId, status: res.status },
            'API-FOOTBALL returned non-ok response during settlement sync',
          );
          continue;
        }

        const parsed = ApiFootballFixturesResponseSchema.safeParse(res.body);

        if (!parsed.success) {
          failedFixtures++;
          logger.error(
            { externalId: fixture.externalId, issues: parsed.error.issues },
            'Zod validation failed during settlement sync — skipping fixture',
          );
          continue;
        }

        const apiFixture = parsed.data.response[0];
        if (!apiFixture) {
          skippedFixtures++;
          logger.warn(
            { externalId: fixture.externalId },
            'Fixture not returned by API-FOOTBALL during settlement sync',
          );
          continue;
        }

        const nextState = mapFixtureState(apiFixture);
        await this.fixtureService.syncFixtureState({
          externalId: fixture.externalId,
          scheduledAt: nextState.scheduledAt,
          status: nextState.status,
          homeScore: nextState.homeScore,
          awayScore: nextState.awayScore,
          homeHtScore: nextState.homeHtScore,
          awayHtScore: nextState.awayHtScore,
        });

        // Early settlement — resolve irrevocable outcomes (BTTS YES/NO, OVER/UNDER
        // thresholds, HT markets) without waiting for FINISHED.
        if (nextState.status === 'IN_PROGRESS') {
          if (nextState.homeScore !== null && nextState.awayScore !== null) {
            const { settled: earlySettled } =
              await this.bettingEngineService.settleEarlyBets(fixture.id);
            settledBets += earlySettled;
          }
          continue;
        }

        if (nextState.status !== 'FINISHED') {
          continue;
        }

        finishedFixtures++;

        const { settled } = await this.bettingEngineService.settleOpenBets(
          fixture.id,
        );
        settledBets += settled;
      } catch (error) {
        failedFixtures++;
        logger.error(
          {
            externalId: fixture.externalId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Unexpected error during settlement sync — skipping fixture',
        );
      }
    }

    logger.info(
      {
        fixtureCount: fixtures.length,
        finishedFixtures,
        settledBets,
        failedFixtures,
        skippedFixtures,
      },
      'Pending bets settlement sync complete',
    );

    // Always attempt coupon settlement — the guard `finishedFixtures > 0` was a
    // bug: once fixtures were already finished from a prior run, subsequent worker
    // executions had finishedFixtures=0 and coupons were never settled.
    await this.couponSettlement.settleReadyProposals();

    if (settledBets > 0) {
      const calibration = await this.adjustmentService.runCalibrationCheck();
      logger.info(
        { calibration },
        'Calibration check complete after settlement',
      );
    }
  }

  @OnWorkerEvent('failed')
  onFailed(
    job: Job<PendingBetsSettlementJobData> | undefined,
    error: Error,
  ): void {
    notifyOnWorkerFailure({
      notification: this.notification,
      queueName: BULLMQ_QUEUES.PENDING_BETS_SETTLEMENT,
      job,
      error,
      logger,
    });
  }
}

function mapFixtureState(item: ApiFootballFixture): {
  scheduledAt: Date;
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  homeHtScore: number | null;
  awayHtScore: number | null;
} {
  return {
    scheduledAt: new Date(item.fixture.date),
    status: mapStatus(item.fixture.status.short),
    // score.fulltime is the 90-minute regulation score — frozen at that value
    // even if the match goes to extra time/penalties, unlike `goals` (the
    // running total, which for AET/PEN matches includes ET+penalty goals).
    // Settlement markets resolve on regulation time only; before minute 90
    // fulltime is null, so fall back to `goals` for live in-progress tracking.
    homeScore: item.score.fulltime.home ?? item.goals.home,
    awayScore: item.score.fulltime.away ?? item.goals.away,
    homeHtScore: item.score.halftime.home,
    awayHtScore: item.score.halftime.away,
  };
}

function mapStatus(status: ApiFootballStatus): FixtureStatus {
  switch (status) {
    case 'FT':
    case 'AET':
    case 'PEN':
    case 'AWD':
      return 'FINISHED';
    case 'PST':
      return 'POSTPONED';
    case 'CANC':
    case 'ABD':
      return 'CANCELLED';
    case '1H':
    case 'HT':
    case '2H':
    case 'ET':
    case 'BT':
    case 'P':
    case 'INT':
      return 'IN_PROGRESS';
    default:
      return 'SCHEDULED';
  }
}
