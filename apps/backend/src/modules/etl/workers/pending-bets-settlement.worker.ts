import { execFile } from 'node:child_process';
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
import { notifyOnWorkerFailure } from './etl-worker.utils';

export type PendingBetsSettlementJobData = Record<string, never>;

const logger = createLogger('pending-bets-settlement-worker');
const CURL_HTTP_CODE_MARKER = '__EVCORE_HTTP_CODE__';

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
        const curlResult = await fetchJsonViaCurl(url, apiKey);

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

        const parsed = ApiFootballFixturesResponseSchema.safeParse(
          res.body,
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

type CurlJsonResponse = {
  status: number;
  body: unknown;
};

type CurlJsonResult = {
  response: CurlJsonResponse | null;
  transientErrorCode?: string;
};

async function fetchJsonViaCurl(
  url: string,
  apiKey: string,
): Promise<CurlJsonResult> {
  try {
    const stdout = await runCurlJsonRequest(url, apiKey);
    const lastMarker = stdout.lastIndexOf(`\n${CURL_HTTP_CODE_MARKER}:`);
    if (lastMarker === -1) {
      throw new Error('curl output missing HTTP code marker');
    }

    const bodyText = stdout.slice(0, lastMarker);
    const statusText = stdout
      .slice(lastMarker + `\n${CURL_HTTP_CODE_MARKER}:`.length)
      .trim();
    const status = Number.parseInt(statusText, 10);

    if (Number.isNaN(status)) {
      throw new Error(`curl returned invalid HTTP code: ${statusText}`);
    }

    let body: unknown = null;
    if (bodyText.trim().length > 0) {
      body = JSON.parse(bodyText);
    }

    return { response: { status, body } };
  } catch (error) {
    const transientErrorCode = getCurlTransientErrorCode(error);
    if (transientErrorCode !== undefined) {
      return { response: null, transientErrorCode };
    }
    throw error;
  }
}

function runCurlJsonRequest(url: string, apiKey: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'curl',
      [
        '--silent',
        '--show-error',
        '--location',
        '--write-out',
        `\n${CURL_HTTP_CODE_MARKER}:%{http_code}`,
        '-H',
        `x-apisports-key: ${apiKey}`,
        url,
      ],
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      },
    );
  });
}

function getCurlTransientErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;

  const message = error.message.toLowerCase();
  if (message.includes('timed out')) return 'ETIMEDOUT';
  if (message.includes('could not resolve host')) return 'ENOTFOUND';
  if (message.includes('connection reset')) return 'ECONNRESET';

  const exitCode = 'code' in error ? (error.code as number | undefined) : null;
  if (exitCode === 28) return 'ETIMEDOUT';
  if (exitCode === 6) return 'ENOTFOUND';
  if (exitCode === 56) return 'ECONNRESET';

  return undefined;
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
