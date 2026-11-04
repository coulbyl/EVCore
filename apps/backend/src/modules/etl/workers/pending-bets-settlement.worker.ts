import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RiskService } from '../../risk/risk.service';
import { Inject, Injectable } from '@nestjs/common';
import { FixtureStatus } from '@evcore/db';
import { createLogger } from '@utils/logger';
import { sleep } from '@utils/async.utils';
import {
  ApiFootballClient,
  isQuotaExceededError,
} from '../api-football.client';
import {
  BULLMQ_QUEUES,
  ETL_CONSTANTS,
  LIVE_FIXTURES,
} from '@config/etl.constants';
import { type ApiFootballStatus } from '../schemas/fixture.schema';
import { FixtureService } from '../../fixture/fixture.service';
import type { PendingSettlementFixture } from '../../fixture/fixture.repository';
import { BettingEngineService } from '../../betting-engine/betting-engine.service';
import { CouponSettlementService } from '../../coupon/coupon-settlement.service';
import { NotificationService } from '../../notification/notification.service';
import { AdjustmentService } from '../../adjustment/adjustment.service';
import { RollingStatsService } from '../../rolling-stats/rolling-stats.service';
import { FixtureEventsService } from '../../fixture-events/fixture-events.service';
import {
  ApiFootballFixturesByIdsResponseSchema,
  FixtureByIdIdentitySchema,
  FixtureByIdStateSchema,
  type FixtureByIdState,
} from '../schemas/fixture-full.schema';
import { notifyOnWorkerFailure } from './etl-worker.utils';

export type PendingBetsSettlementJobData = Record<string, never>;

/**
 * Nom du job déclenchant le balayage du garde-fou de ROI plutôt que le
 * règlement des paris. Même file, deux cadences : le règlement passe toutes
 * les demi-heures, le balayage une fois par jour.
 */
export const RISK_MARKET_SWEEP_JOB = 'risk-market-sweep';

/**
 * Nom du job de la relève du direct (ETL_CRON_SCHEDULES.LIVE_FIXTURES) :
 * même travail que le règlement, sur les seuls matchs commencés depuis
 * LIVE_FIXTURES.WINDOW_HOURS et pas finis (findLiveFixtures), toutes les
 * 5 minutes.
 */
export const LIVE_FIXTURES_JOB = 'live-fixtures';

type PassTally = {
  finishedFixtures: number;
  // Of which stored not FINISHED before this pass (a transition).
  newlyFinished: number;
  settledBets: number;
  failedFixtures: number;
  skippedFixtures: number;
  // /fixtures?ids= calls spent.
  calls: number;
};

// One fixture's validated state, and its raw entry for the events writer.
type FixtureEntry = { state: FixtureByIdState; raw: unknown };

const HOUR_MS = 60 * 60 * 1000;

const logger = createLogger('pending-bets-settlement-worker');

@Injectable()
@Processor(BULLMQ_QUEUES.PENDING_BETS_SETTLEMENT)
export class PendingBetsSettlementWorker extends WorkerHost {
  // Bets settled by the live passes since the last calibration check.
  private settledSinceCalibration = 0;

  @Inject(NotificationService)
  private notification!: NotificationService;

  @Inject(ApiFootballClient)
  private apiFootball!: ApiFootballClient;

  @Inject(CouponSettlementService)
  private couponSettlement!: CouponSettlementService;

  @Inject(FixtureEventsService)
  private fixtureEvents!: FixtureEventsService;

  // eslint-disable-next-line max-params -- DI constructor, same convention as FixturesSyncWorker.
  constructor(
    private readonly fixtureService: FixtureService,
    private readonly bettingEngineService: BettingEngineService,
    private readonly adjustmentService: AdjustmentService,
    private readonly rollingStatsService: RollingStatsService,
    private readonly riskService: RiskService,
  ) {
    super();
  }

  async process(job: Job<PendingBetsSettlementJobData>): Promise<void> {
    if (job.name === RISK_MARKET_SWEEP_JOB) {
      await this.riskService.checkAllMarkets();
      return;
    }

    const live = job.name === LIVE_FIXTURES_JOB;
    const now = new Date();
    const fixtures = live
      ? await this.fixtureService.findLiveFixtures({
          now,
          since: new Date(now.getTime() - LIVE_FIXTURES.WINDOW_HOURS * HOUR_MS),
        })
      : await this.fixtureService.findPendingSettlementFixtures(now);
    // Nothing kicked off: no call, nothing to settle.
    if (live && fixtures.length === 0) return;

    logger.info(
      { fixtureCount: fixtures.length, live },
      live
        ? 'Starting live fixtures pass'
        : 'Starting pending bets settlement sync',
    );

    const tally: PassTally = {
      finishedFixtures: 0,
      newlyFinished: 0,
      settledBets: 0,
      failedFixtures: 0,
      skippedFixtures: 0,
      calls: 0,
    };
    // Same rationale as stale-scheduled-sync.worker.ts: this is the other
    // fallback path that finalizes fixtures outside the routine
    // fixtures-sync job, so it must trigger the same rolling-stats refresh
    // that job's own `affectsRollingStats` aggregation does — otherwise
    // team_stats silently freezes for whatever competition's finishes keep
    // landing here (2026-09-07 ISL1 incident).
    const changedBySeason = new Map<string, Set<string>>();

    const entries = await this.fetchEntries(fixtures, tally);
    for (const fixture of fixtures) {
      const entry = entries.get(fixture.externalId);
      if (entry === undefined) continue;
      try {
        const changed = await this.applyEntry({ fixture, entry, tally });
        if (changed) {
          const ids = changedBySeason.get(changed.seasonId) ?? new Set();
          ids.add(changed.fixtureId);
          changedBySeason.set(changed.seasonId, ids);
        }
      } catch (error) {
        tally.failedFixtures++;
        logger.error(
          {
            externalId: fixture.externalId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Unexpected error during settlement sync — skipping fixture',
        );
      }
    }

    for (const [seasonId, changedFixtureIds] of changedBySeason) {
      await this.rollingStatsService.refreshSeason(seasonId, {
        changedFixtureIds,
      });
    }

    logger.info(
      {
        live,
        fixtureCount: fixtures.length,
        ...tally,
        seasonsRefreshed: changedBySeason.size,
      },
      live
        ? 'Live fixtures pass complete'
        : 'Pending bets settlement sync complete',
    );

    // The settlement pass always settles coupons — the guard
    // `finishedFixtures > 0` was a bug: once fixtures were already finished
    // from a prior run, subsequent executions had finishedFixtures=0 and
    // coupons were never settled. The live pass does on a whistle or a bet
    // settled — a transition, not a state: a finished match retried for its
    // events settles nothing again —, so a coupon settles minutes after its
    // last whistle.
    if (!live || tally.newlyFinished > 0 || tally.settledBets > 0) {
      await this.couponSettlement.settleReadyProposals();
    }

    // The calibration check reads every settled bet: once per settlement
    // pass, for the bets settled by it or by the live passes before it.
    this.settledSinceCalibration += tally.settledBets;
    if (!live && this.settledSinceCalibration > 0) {
      this.settledSinceCalibration = 0;
      const calibration = await this.adjustmentService.runCalibrationCheck();
      logger.info(
        { calibration },
        'Calibration check complete after settlement',
      );
    }
  }

  // The answers of the given fixtures, FIXTURES_BY_IDS_BATCH_SIZE per
  // /fixtures?ids= call. A fixture missing from the map was counted
  // skipped (transient, absent, quota) or failed (rejected answer).
  private async fetchEntries(
    fixtures: readonly PendingSettlementFixture[],
    tally: PassTally,
  ): Promise<Map<number, FixtureEntry>> {
    const entries = new Map<number, FixtureEntry>();
    const batchSize = ETL_CONSTANTS.FIXTURES_BY_IDS_BATCH_SIZE;
    for (let start = 0; start < fixtures.length; start += batchSize) {
      const ids = fixtures
        .slice(start, start + batchSize)
        .map((fixture) => fixture.externalId);
      if (start > 0) await sleep(ETL_CONSTANTS.STATS_RATE_LIMIT_MS);

      const url = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/fixtures?ids=${ids.join('-')}`;
      const curlResult = await this.apiFootball.fetchJson(url);
      tally.calls++;

      if (curlResult.response === null) {
        tally.skippedFixtures += ids.length;
        logger.warn(
          { ids },
          'Transient network error while fetching fixture settlement state — skipping batch',
        );
        continue;
      }
      const res = curlResult.response;

      if (res.status === 429 || isQuotaExceededError(res.body)) {
        // Nothing more is asked: the rest waits for the next pass.
        tally.skippedFixtures += fixtures.length - start;
        logger.warn(
          { ids, status: res.status },
          'API-FOOTBALL quota or rate limit reached — settlement pass stopped',
        );
        break;
      }

      if (res.status < 200 || res.status >= 300) {
        tally.failedFixtures += ids.length;
        logger.error(
          { ids, status: res.status },
          'API-FOOTBALL returned non-ok response during settlement sync',
        );
        continue;
      }

      const envelope = ApiFootballFixturesByIdsResponseSchema.safeParse(
        res.body,
      );
      if (!envelope.success) {
        tally.failedFixtures += ids.length;
        logger.error(
          { ids, issues: envelope.error.issues },
          'Zod validation failed during settlement sync — skipping batch',
        );
        continue;
      }

      // One malformed entry never costs the other nineteen their state.
      const answered = new Set<number>();
      for (const raw of envelope.data.response) {
        const state = FixtureByIdStateSchema.safeParse(raw);
        if (!state.success) {
          const id = FixtureByIdIdentitySchema.safeParse(raw);
          if (id.success) answered.add(id.data.fixture.id);
          tally.failedFixtures++;
          logger.error(
            {
              externalId: id.success ? id.data.fixture.id : null,
              issues: state.error.issues,
            },
            'Zod validation failed during settlement sync — skipping fixture',
          );
          continue;
        }
        answered.add(state.data.fixture.id);
        entries.set(state.data.fixture.id, { state: state.data, raw });
      }
      for (const externalId of ids) {
        if (answered.has(externalId)) continue;
        tally.skippedFixtures++;
        logger.warn(
          { externalId },
          'Fixture not returned by API-FOOTBALL during settlement sync',
        );
      }
    }
    return entries;
  }

  // One fixture's answer: its state, its early or final settlement, and at
  // the whistle its events. Returns the fixture when its rolling stats need
  // a refresh.
  private async applyEntry(input: {
    fixture: PendingSettlementFixture;
    entry: FixtureEntry;
    tally: PassTally;
  }): Promise<{ seasonId: string; fixtureId: string } | null> {
    const { fixture, entry, tally } = input;
    const nextState = mapFixtureState(entry.state);
    const { affectsRollingStats, seasonId, fixtureId } =
      await this.fixtureService.syncFixtureState({
        externalId: fixture.externalId,
        scheduledAt: nextState.scheduledAt,
        status: nextState.status,
        homeScore: nextState.homeScore,
        awayScore: nextState.awayScore,
        homeHtScore: nextState.homeHtScore,
        awayHtScore: nextState.awayHtScore,
        live: nextState.live,
      });
    const changed =
      affectsRollingStats && seasonId && fixtureId
        ? { seasonId, fixtureId }
        : null;

    // Early settlement — resolve irrevocable outcomes (BTTS YES/NO, OVER/UNDER
    // thresholds, HT markets) without waiting for FINISHED.
    if (nextState.status === 'IN_PROGRESS') {
      if (nextState.homeScore !== null && nextState.awayScore !== null) {
        const { settled } = await this.bettingEngineService.settleEarlyBets(
          fixture.id,
        );
        tally.settledBets += settled;
      }
      return changed;
    }

    if (nextState.status !== 'FINISHED') return changed;

    tally.finishedFixtures++;
    if (fixture.status !== 'FINISHED') tally.newlyFinished++;

    // The answer that says FINISHED carries the events, lineups and player
    // statistics too: written now through the one writer, the scorers show
    // within this pass instead of waiting for the stats sync, which
    // corrects them after (FixtureEventsService.isSynced). Before the
    // settlement, which reads them. Once — when the match turns FINISHED,
    // or while it has no event — not on every pass a bet stays pending. A
    // rejection never costs the fixture its settlement.
    if (fixture.status !== 'FINISHED' || !fixture.hasEvents) {
      await this.fixtureEvents.writeEntry({
        fixtureExternalId: fixture.externalId,
        observedAt: new Date(),
        entry: entry.raw,
      });
    }

    const { settled } = await this.bettingEngineService.settleOpenBets(
      fixture.id,
    );
    tally.settledBets += settled;
    return changed;
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

function mapFixtureState(item: FixtureByIdState): {
  scheduledAt: Date;
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  homeHtScore: number | null;
  awayHtScore: number | null;
  live: { status: string; elapsed: number | null };
} {
  return {
    scheduledAt: new Date(item.fixture.date),
    status: mapStatus(item.fixture.status.short),
    // score.fulltime is the 90-minute regulation score — frozen at that value
    // even if the match goes to extra time/penalties, unlike `goals` (the
    // running total, which for AET/PEN matches includes ET+penalty goals).
    // Settlement markets resolve on regulation time only; before minute 90
    // fulltime is null, so fall back to `goals` for live in-progress tracking.
    homeScore: item.score?.fulltime?.home ?? item.goals?.home ?? null,
    awayScore: item.score?.fulltime?.away ?? item.goals?.away ?? null,
    homeHtScore: item.score?.halftime?.home ?? null,
    awayHtScore: item.score?.halftime?.away ?? null,
    // Stored only while in progress (liveClockOf).
    live: {
      status: item.fixture.status.short,
      elapsed: item.fixture.status.elapsed ?? null,
    },
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
