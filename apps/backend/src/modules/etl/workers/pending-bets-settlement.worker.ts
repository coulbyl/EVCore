import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FixtureStatus } from '@evcore/db';
import { createLogger } from '@utils/logger';
import { BULLMQ_QUEUES, ETL_CONSTANTS } from '@config/etl.constants';
import {
  ApiFootballFixturesResponseSchema,
  type ApiFootballFixture,
  type ApiFootballStatus,
} from '../schemas/fixture.schema';
import { FixtureService } from '../../fixture/fixture.service';
import { BettingEngineService } from '../../betting-engine/betting-engine.service';
import { CouponService } from '../../coupon/coupon.service';
import { NotificationService } from '../../notification/notification.service';
import { AdjustmentService } from '../../adjustment/adjustment.service';
import { fetchOrSkip, notifyOnWorkerFailure } from './etl-worker.utils';

export type PendingBetsSettlementJobData = Record<string, never>;

const logger = createLogger('pending-bets-settlement-worker');

@Injectable()
@Processor(BULLMQ_QUEUES.PENDING_BETS_SETTLEMENT)
export class PendingBetsSettlementWorker extends WorkerHost {
  @Inject(NotificationService)
  private notification!: NotificationService;

  @Inject(ConfigService)
  private config!: ConfigService;

  // eslint-disable-next-line max-params -- Settlement worker needs adjustment service for learning loop.
  constructor(
    private readonly fixtureService: FixtureService,
    private readonly bettingEngineService: BettingEngineService,
    private readonly couponService: CouponService,
    private readonly adjustmentService: AdjustmentService,
  ) {
    super();
  }

  async process(_job: Job<PendingBetsSettlementJobData>): Promise<void> {
    const fixtures = await this.fixtureService.findPendingSettlementFixtures(
      new Date(),
    );
    const apiKey = this.config.getOrThrow<string>('API_FOOTBALL_KEY');

    logger.info(
      { fixtureCount: fixtures.length },
      'Starting pending bets settlement sync',
    );

    let finishedFixtures = 0;
    let settledBets = 0;
    let settledCoupons = 0;
    let failedFixtures = 0;
    let skippedFixtures = 0;

    for (const fixture of fixtures) {
      try {
        const url = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/fixtures?id=${fixture.externalId}`;
        const res = await fetchOrSkip(url, {
          headers: { 'x-apisports-key': apiKey },
        });

        if (res === null) {
          skippedFixtures++;
          logger.warn(
            { externalId: fixture.externalId },
            'Transient network error while fetching fixture settlement state — skipping fixture',
          );
          continue;
        }

        if (!res.ok) {
          failedFixtures++;
          logger.error(
            { externalId: fixture.externalId, status: res.status },
            'API-FOOTBALL returned non-ok response during settlement sync',
          );
          continue;
        }

        const parsed = ApiFootballFixturesResponseSchema.safeParse(
          await res.json(),
        );

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

        if (nextState.status !== 'FINISHED') {
          continue;
        }

        finishedFixtures++;

        const { settled } = await this.bettingEngineService.settleOpenBets(
          fixture.id,
        );
        settledBets += settled;

        const { settledCount } =
          await this.couponService.settlePendingCouponsByFixture(fixture.id);
        settledCoupons += settledCount;
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

    const { settledCount: expiredCouponsSettled } =
      await this.couponService.settleExpiredCoupons(new Date());

    logger.info(
      {
        fixtureCount: fixtures.length,
        finishedFixtures,
        settledBets,
        settledCoupons: settledCoupons + expiredCouponsSettled,
        failedFixtures,
        skippedFixtures,
      },
      'Pending bets settlement sync complete',
    );

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
    homeScore: item.goals.home,
    awayScore: item.goals.away,
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
