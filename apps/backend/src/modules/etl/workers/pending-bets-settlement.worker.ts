import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RiskService } from '../../risk/risk.service';
import { Inject, Injectable } from '@nestjs/common';
import { FixtureStatus } from '@evcore/db';
import { createLogger } from '@utils/logger';
import { ApiFootballClient } from '../api-football.client';
import { BULLMQ_QUEUES, LIVE_FIXTURES } from '@config/etl.constants';
import { loadFixturesByIds } from '../fixtures-by-ids.loader';
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
  // Finished matches whose events, lineups or player statistics were
  // written by this pass.
  newFacts: number;
  failedFixtures: number;
  skippedFixtures: number;
  // /fixtures?ids= calls spent.
  calls: number;
};

/** What tells the live pass from the settlement pass. */
type PassPolicy = {
  /** For the logs. */
  label: string;
  fixtures: (now: Date) => Promise<PendingSettlementFixture[]>;
  /** No fixture: no call, nothing to settle, not even the coupons. */
  skipWhenEmpty: boolean;
  /** Bets settled only when the score or the status moved, or facts came. */
  settlesOnChangeOnly: boolean;
  settlesCoupons: (tally: PassTally) => boolean;
  checksCalibration: boolean;
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
  // Finished matches answered without any event, by API-Football id: past
  // LIVE_FIXTURES.MAX_EMPTY_EVENTS_ANSWERS they leave the live pass. Kept
  // in memory (no column for it) and only for the matches still in the
  // window; a restart asks them again, a few calls at most.
  private readonly emptyEventAnswers = new Map<number, number>();

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

    const policy =
      job.name === LIVE_FIXTURES_JOB
        ? this.livePolicy()
        : this.settlementPolicy();
    const fixtures = await policy.fixtures(new Date());
    // Nothing kicked off: no call, nothing to settle.
    if (policy.skipWhenEmpty && fixtures.length === 0) return;

    logger.info(
      { fixtureCount: fixtures.length, pass: policy.label },
      `Starting ${policy.label} pass`,
    );

    const tally: PassTally = {
      finishedFixtures: 0,
      newlyFinished: 0,
      settledBets: 0,
      newFacts: 0,
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
        const changed = await this.applyEntry({
          fixture,
          entry,
          tally,
          policy,
        });
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
        pass: policy.label,
        fixtureCount: fixtures.length,
        ...tally,
        seasonsRefreshed: changedBySeason.size,
      },
      `${policy.label} pass complete`,
    );

    if (policy.settlesCoupons(tally)) {
      await this.couponSettlement.settleReadyProposals();
    }

    // The calibration check reads every settled bet: once per settlement
    // pass, for the bets settled by it or by the live passes before it.
    this.settledSinceCalibration += tally.settledBets;
    if (policy.checksCalibration && this.settledSinceCalibration > 0) {
      this.settledSinceCalibration = 0;
      const calibration = await this.adjustmentService.runCalibrationCheck();
      logger.info(
        { calibration },
        'Calibration check complete after settlement',
      );
    }
  }

  /**
   * The live pass, every 5 minutes: the matches started within
   * LIVE_FIXTURES.WINDOW_HOURS and not done, a finished one while the API
   * has none of its events — up to MAX_EMPTY_EVENTS_ANSWERS empty answers.
   * Bets settle on a change of score or status, coupons on a whistle, a bet
   * settled or new facts — a transition, not a state —, so a coupon settles
   * minutes after its last whistle.
   */
  private livePolicy(): PassPolicy {
    return {
      label: 'live fixtures',
      fixtures: (now) => this.liveFixtures(now),
      skipWhenEmpty: true,
      settlesOnChangeOnly: true,
      settlesCoupons: (tally) =>
        tally.newlyFinished > 0 || tally.settledBets > 0 || tally.newFacts > 0,
      checksCalibration: false,
    };
  }

  /**
   * The settlement pass, every 30 minutes: every match with a pending bet
   * or analysed and past its kick-off, but the ones the live pass follows
   * (not the same calls twice at :00 and :30). It settles on every pass —
   * the replay that catches what a live pass missed — and always settles
   * coupons: once fixtures were finished by a prior run a guard on this
   * pass's finishes never settled them.
   */
  private settlementPolicy(): PassPolicy {
    return {
      label: 'pending bets settlement',
      fixtures: async (now) => {
        const [pending, live] = await Promise.all([
          this.fixtureService.findPendingSettlementFixtures(now),
          this.liveFixtures(now),
        ]);
        const followed = new Set(live.map((fixture) => fixture.id));
        return pending.filter((fixture) => !followed.has(fixture.id));
      },
      skipWhenEmpty: false,
      settlesOnChangeOnly: false,
      settlesCoupons: () => true,
      checksCalibration: true,
    };
  }

  /** What the live pass asks for, without the finished matches given up on. */
  private async liveFixtures(now: Date): Promise<PendingSettlementFixture[]> {
    const fixtures = await this.fixtureService.findLiveFixtures({
      now,
      since: new Date(now.getTime() - LIVE_FIXTURES.WINDOW_HOURS * HOUR_MS),
    });
    // Bounded: only the matches still in the window keep their count.
    const inWindow = new Set(fixtures.map((fixture) => fixture.externalId));
    for (const externalId of this.emptyEventAnswers.keys()) {
      if (!inWindow.has(externalId)) this.emptyEventAnswers.delete(externalId);
    }
    return fixtures.filter(
      (fixture) =>
        (this.emptyEventAnswers.get(fixture.externalId) ?? 0) <
        LIVE_FIXTURES.MAX_EMPTY_EVENTS_ANSWERS,
    );
  }

  // The validated answers of the given fixtures (loadFixturesByIds). A
  // fixture missing from the map was counted skipped (transient, absent,
  // quota) or failed (error or rejected answer).
  private async fetchEntries(
    fixtures: readonly PendingSettlementFixture[],
    tally: PassTally,
  ): Promise<Map<number, FixtureEntry>> {
    const load = await loadFixturesByIds({
      apiFootball: this.apiFootball,
      externalIds: fixtures.map((fixture) => fixture.externalId),
      logger,
    });
    tally.calls += load.calls;
    // Nothing more is asked past the quota: the rest waits for the next pass.
    tally.skippedFixtures += load.notAsked.length;
    for (const reason of load.missed.values()) {
      if (reason === 'network' || reason === 'absent') tally.skippedFixtures++;
      else tally.failedFixtures++;
    }

    // One malformed entry never costs the other nineteen their state.
    const entries = new Map<number, FixtureEntry>();
    for (const [externalId, raw] of load.entries) {
      const state = FixtureByIdStateSchema.safeParse(raw);
      if (!state.success) {
        tally.failedFixtures++;
        logger.error(
          { externalId, issues: state.error.issues },
          'Zod validation failed during settlement sync — skipping fixture',
        );
        continue;
      }
      entries.set(externalId, { state: state.data, raw });
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
    policy: PassPolicy;
  }): Promise<{ seasonId: string; fixtureId: string } | null> {
    const { fixture, entry, tally, policy } = input;
    const nextState = mapFixtureState(entry.state);
    const synced = await this.fixtureService.syncFixtureState({
      externalId: fixture.externalId,
      ...nextState,
    });
    const changed =
      synced.affectsRollingStats && synced.seasonId && synced.fixtureId
        ? { seasonId: synced.seasonId, fixtureId: synced.fixtureId }
        : null;
    // A score or a status that moved; a settlement pass settles regardless.
    const settles = !policy.settlesOnChangeOnly || synced.changed;

    // Early settlement — resolve irrevocable outcomes (BTTS YES/NO, OVER/UNDER
    // thresholds, HT markets) without waiting for FINISHED.
    if (nextState.status === 'IN_PROGRESS') {
      if (
        settles &&
        nextState.homeScore !== null &&
        nextState.awayScore !== null
      ) {
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
    let newFacts = false;
    if (fixture.status !== 'FINISHED' || !fixture.hasEvents) {
      const written = await this.fixtureEvents.writeEntry({
        fixtureExternalId: fixture.externalId,
        observedAt: new Date(),
        entry: entry.raw,
      });
      const events = written.status === 'written' ? written.events : 0;
      newFacts =
        written.status === 'written' &&
        events + written.lineups + written.playerStatistics > 0;
      if (newFacts) tally.newFacts++;
      if (events > 0) {
        this.emptyEventAnswers.delete(fixture.externalId);
      } else {
        this.emptyEventAnswers.set(
          fixture.externalId,
          (this.emptyEventAnswers.get(fixture.externalId) ?? 0) + 1,
        );
      }
    }

    if (settles || newFacts) {
      const { settled } = await this.bettingEngineService.settleOpenBets(
        fixture.id,
      );
      tally.settledBets += settled;
    }
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
