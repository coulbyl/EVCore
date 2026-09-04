import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import { BetStatus, Market } from '@evcore/db';
import { ChannelDecisionService } from './channel-decision.service';
import type { ChannelDecisionRepository } from './channel-decision.repository';
import { buildStrategyContext } from './strategies/strategy-context.builder';
import {
  CHANNEL_DECISION_STATUS,
  STRATEGY_CHANNEL,
  type StrategyContext,
} from './channel-strategy.types';
import type {
  EvaluatedPick,
  FullOddsSnapshot,
  MatchProbabilities,
} from './betting-engine.types';

const ODDS: FullOddsSnapshot = {
  bookmaker: 'Pinnacle',
  snapshotAt: new Date(),
  homeOdds: new Decimal('1.90'),
  drawOdds: new Decimal('3.30'),
  awayOdds: new Decimal('4.50'),
  // UNDER_3_5 priced so GOALS has a book price to select on (commit 4a10108:
  // an unpriced above-threshold candidate is rejected, never selected).
  overUnderOdds: { UNDER_3_5: new Decimal('1.30') },
  bttsYesOdds: null,
  bttsNoOdds: null,
  htftOdds: {},
  ouHtOdds: {},
  firstHalfWinnerOdds: null,
  doubleChanceOdds: null,
  drawNoBetOdds: null,
  teamTotalHomeOdds: {},
  teamTotalAwayOdds: {},
  cleanSheetHomeOdds: null,
  cleanSheetAwayOdds: null,
  winToNilHomeOdds: null,
  winToNilAwayOdds: null,
  winEitherHalfOdds: null,
  resultTotalGoalsOdds: {},
  resultBttsOdds: {},
};

function richContext(): StrategyContext {
  // No longer read by VALUE/SAFE (Phase 2 since 2026-08-18, filtering
  // previousDecisions instead of evaluatedMarkets) — kept only because
  // buildStrategyContext still requires evaluatedPicks. TODO.md: candidate
  // for removal alongside evaluatedMarkets.
  const evPick: EvaluatedPick = {
    market: Market.ONE_X_TWO,
    pick: 'HOME',
    probability: new Decimal('0.64'),
    odds: new Decimal('1.90'),
    ev: new Decimal('0.22'),
    qualityScore: new Decimal('0.20'),
  };
  return buildStrategyContext({
    fixture: {
      id: 'f1',
      homeTeamId: 'h1',
      awayTeamId: 'a1',
      scheduledAt: new Date(),
    },
    competitionCode: 'BL1',
    deterministicScore: new Decimal('0.80'),
    probabilities: {
      // home=0.65 (not 0.60): VALUE/SAFE no longer read evaluatedMarkets
      // (Phase 2 since 2026-08-18, filtering previousDecisions instead) —
      // VALUE's ONE_X_TWO candidate now comes from what DOMINANT itself
      // derives from these probabilities, and needs edge ≥ VALUE_MIN_EDGE
      // (0.65 − 1/1.90 = 0.126 ≥ 0.10).
      home: new Decimal('0.65'),
      draw: new Decimal('0.20'),
      away: new Decimal('0.15'),
      bttsYes: new Decimal('0.65'),
      bttsNo: new Decimal('0.35'),
      over15: new Decimal('0.74'),
      under15: new Decimal('0.26'),
      over25: new Decimal('0.40'),
      under25: new Decimal('0.60'),
      over35: new Decimal('0.18'),
      under35: new Decimal('0.82'),
      over45: new Decimal('0.07'),
      under45: new Decimal('0.93'),
      cleanSheetHome: new Decimal('0.30'),
      cleanSheetAway: new Decimal('0.20'),
      winEitherHalfHome: new Decimal('0.55'),
      winEitherHalfAway: new Decimal('0.45'),
      teamTotalHome: {},
      teamTotalAway: {},
      ouHT: {},
      resultTotalGoals: {},
      resultBtts: {},
      // Below BL1's DRAW_NO_BET_CONFIG threshold (0.5125) so DRAW_NO_BET is
      // REJECTED here, not exercised beyond the probability read.
      dnbHome: new Decimal('0.5'),
      dnbAway: new Decimal('0.35'),
      // Below BL1's WIN_TO_NIL_CONFIG threshold (0.15) so WIN_TO_NIL is
      // REJECTED here, not exercised beyond the probability read.
      winToNilHome: new Decimal('0.1'),
      winToNilAway: new Decimal('0.08'),
      // Below DOUBLE_CHANCE_CONFIG.minProbability (0.75) so DOUBLE_CHANCE is
      // REJECTED here, not exercised beyond the probability read.
      dc1X: new Decimal('0.5'),
      dcX2: new Decimal('0.5'),
      dc12: new Decimal('0.5'),
      // Below BL1's FIRST_HALF_CONFIG threshold (0.31) so FIRST_HALF_WINNER
      // is REJECTED here, not exercised beyond the probability read.
      firstHalfWinner: {
        home: new Decimal('0.3'),
        draw: new Decimal('0.3'),
        away: new Decimal('0.3'),
      },
      // htftOdds is empty in this fixture's ODDS, so every HALF_TIME_FULL_TIME
      // pick resolves to no price and is skipped before its probability is
      // read — populated anyway for completeness/defensiveness.
      htft: {
        HOME_HOME: new Decimal('0'),
        HOME_DRAW: new Decimal('0'),
        HOME_AWAY: new Decimal('0'),
        DRAW_HOME: new Decimal('0'),
        DRAW_DRAW: new Decimal('0'),
        DRAW_AWAY: new Decimal('0'),
        AWAY_HOME: new Decimal('0'),
        AWAY_DRAW: new Decimal('0'),
        AWAY_AWAY: new Decimal('0'),
      },
    } as unknown as MatchProbabilities,
    evaluatedPicks: [evPick],
    odds: ODDS,
    signals: {
      suspendedMarkets: new Set(),
      lambdaFloorHit: false,
      lambdaTotal: 2.5,
      lineMovement: null,
      h2h: null,
      congestion: null,
    },
  });
}

describe('ChannelDecisionService', () => {
  it('evaluates every v1 strategy and persists the decisions for the run', async () => {
    const persistedResult = [{ id: 'cd-ev' }];
    const saveRunDecisions = vi.fn().mockResolvedValue(persistedResult);
    const repo = { saveRunDecisions } as unknown as ChannelDecisionRepository;
    const service = new ChannelDecisionService(repo);

    const returned = await service.recordRunDecisions('run-1', richContext());

    expect(saveRunDecisions).toHaveBeenCalledTimes(1);
    const [runId, evaluated] = saveRunDecisions.mock.calls[0];
    expect(runId).toBe('run-1');

    // Orchestrator ran every primary strategy (incl. CORRECT_SCORE, CLEAN_SHEET,
    // TEAM_TOTAL, WIN_EITHER_HALF, RESULT_TOTAL_GOALS, OVER_UNDER_HT,
    // RESULT_BTTS, DRAW_NO_BET, WIN_TO_NIL, FIRST_HALF_WINNER,
    // HALF_TIME_FULL_TIME, DOUBLE_CHANCE) + the CONSENSUS & AVOID
    // meta-strategies.
    expect(evaluated).toHaveLength(20);

    // CORRECT_SCORE: this context carries no lambdas → the strategy can't build
    // the score matrix → REJECTED (no_model), still recorded as a decision.
    const correctScore = evaluated.find(
      (d: { channel: string }) => d.channel === STRATEGY_CHANNEL.CORRECT_SCORE,
    );
    expect(correctScore?.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(correctScore?.reasonCode).toBe('no_model');
    const ev = evaluated.find(
      (d: { channel: string }) => d.channel === STRATEGY_CHANNEL.VALUE,
    );
    expect(ev?.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(ev?.selections[0]?.pick).toBe('HOME');

    // GOALS BL1 is enabled (observation) across lines: Over 1.5 (0.74 < 0.78)
    // and Over 2.5 (0.40 < 0.45, retuned 2026-07-24) fail their gates, but
    // Under 3.5 (0.82 ≥ 0.53) clears → SELECTED on the UNDER_3_5 line.
    const goals = evaluated.find(
      (d: { channel: string }) => d.channel === STRATEGY_CHANNEL.GOALS,
    );
    expect(goals?.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(goals?.selections[0]?.pick).toBe('UNDER_3_5');

    // CONSENSUS (phase 2) fires: DOMINANT (directional) + VALUE (value) both
    // selected HOME → two independent classes agree → SELECTED HOME.
    const consensus = evaluated.find(
      (d: { channel: string }) => d.channel === STRATEGY_CHANNEL.CONSENSUS,
    );
    expect(consensus?.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    // Meta-strategy: reports the agreement in reasonDetails, emits no
    // selection of its own (consensus.strategy.ts, 2026-08-22).
    expect(consensus?.selections).toHaveLength(0);
    expect(
      (consensus?.reasonDetails as { pick?: string } | undefined)?.pick,
    ).toBe('HOME');

    // AVOID (phase 2): the HOME pick edge (0.64 − 1/1.90 ≈ 0.11) is nowhere near
    // the 0.30 divergence floor → nothing to avoid.
    const avoid = evaluated.find(
      (d: { channel: string }) => d.channel === STRATEGY_CHANNEL.AVOID,
    );
    expect(avoid?.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);

    // The persisted result (with selection ids) is forwarded to the caller.
    expect(returned).toBe(persistedResult);
  });

  it('propagates repository failures', async () => {
    const repo = {
      saveRunDecisions: vi.fn().mockRejectedValue(new Error('db down')),
    } as unknown as ChannelDecisionRepository;
    const service = new ChannelDecisionService(repo);

    await expect(
      service.recordRunDecisions('run-1', richContext()),
    ).rejects.toThrow('db down');
  });

  describe('settleFixtureSelections', () => {
    const SCORES = {
      homeScore: 2,
      awayScore: 1,
      homeHtScore: 1,
      awayHtScore: 0,
    };

    it('final-settles every selection from the definitive score', async () => {
      const findSelectionsForFixture = vi.fn().mockResolvedValue([
        {
          id: 's1',
          market: Market.ONE_X_TWO,
          pick: 'HOME',
        },
        {
          id: 's2',
          market: Market.ONE_X_TWO,
          pick: 'AWAY',
        },
      ]);
      const applySelectionResults = vi.fn().mockResolvedValue(undefined);
      const repo = {
        findSelectionsForFixture,
        applySelectionResults,
      } as unknown as ChannelDecisionRepository;
      const service = new ChannelDecisionService(repo);

      const { settled } = await service.settleFixtureSelections({
        fixtureId: 'f1',
        scores: SCORES,
        mode: 'final',
      });

      expect(settled).toBe(2);
      expect(findSelectionsForFixture).toHaveBeenCalledWith('f1', {
        onlyUnsettled: false,
      });
      expect(applySelectionResults).toHaveBeenCalledWith([
        { id: 's1', result: BetStatus.WON },
        { id: 's2', result: BetStatus.LOST },
      ]);
    });

    it('early-settles only irrevocable selections and skips the rest', async () => {
      const findSelectionsForFixture = vi.fn().mockResolvedValue([
        // BTTS confirmed (both scored) → settled
        {
          id: 'btts',
          market: Market.BTTS,
          pick: 'YES',
        },
        // 1X2 never early-settles → skipped
        {
          id: 'x12',
          market: Market.ONE_X_TWO,
          pick: 'HOME',
        },
      ]);
      const applySelectionResults = vi.fn().mockResolvedValue(undefined);
      const repo = {
        findSelectionsForFixture,
        applySelectionResults,
      } as unknown as ChannelDecisionRepository;
      const service = new ChannelDecisionService(repo);

      const { settled } = await service.settleFixtureSelections({
        fixtureId: 'f1',
        scores: {
          homeScore: 1,
          awayScore: 1,
          homeHtScore: null,
          awayHtScore: null,
        },
        mode: 'early',
      });

      expect(settled).toBe(1);
      expect(findSelectionsForFixture).toHaveBeenCalledWith('f1', {
        onlyUnsettled: true,
      });
      expect(applySelectionResults).toHaveBeenCalledWith([
        { id: 'btts', result: BetStatus.WON },
      ]);
    });
  });

  describe('listByMatch', () => {
    it('maps read rows to normalised DTOs and forwards filters', async () => {
      const findByDate = vi.fn().mockResolvedValue([
        {
          id: 'cd-ev',
          modelRunId: 'run-1',
          channel: STRATEGY_CHANNEL.VALUE,
          status: CHANNEL_DECISION_STATUS.SELECTED,
          reasonCode: null,
          fixtureId: 'f1',
          createdAt: new Date('2026-01-18T13:00:00.000Z'),
          scheduledAt: new Date('2026-01-18T14:00:00.000Z'),
          homeTeam: 'Home',
          awayTeam: 'Away',
          homeLogo: 'https://logo/home.png',
          awayLogo: null,
          competitionCode: 'BL1',
          country: 'Germany',
          homeScore: 2,
          awayScore: 1,
          homeHtScore: 1,
          awayHtScore: 0,
          selections: [
            {
              market: Market.ONE_X_TWO,
              pick: 'HOME',
              probability: new Decimal('0.6'),
              odds: new Decimal('1.9'),
              impliedProbability: null,
              ev: new Decimal('0.14'),
              qualityScore: null,
              rank: 1,
              result: BetStatus.WON,
            },
          ],
        },
        {
          id: 'cd-safe',
          modelRunId: 'run-1',
          channel: STRATEGY_CHANNEL.SAFE,
          status: CHANNEL_DECISION_STATUS.REJECTED,
          reasonCode: 'no_safe_candidate',
          fixtureId: 'f1',
          createdAt: new Date('2026-01-18T13:05:00.000Z'),
          scheduledAt: new Date('2026-01-18T14:00:00.000Z'),
          homeTeam: 'Home',
          awayTeam: 'Away',
          homeLogo: null,
          awayLogo: null,
          competitionCode: 'BL1',
          country: 'Germany',
          homeScore: null,
          awayScore: null,
          homeHtScore: null,
          awayHtScore: null,
          selections: [],
        },
      ]);
      const findNewCoachTeams = vi.fn().mockResolvedValue(new Set());
      const repo = {
        findByDate,
        findNewCoachTeams,
      } as unknown as ChannelDecisionRepository;
      const service = new ChannelDecisionService(repo);

      const groups = await service.listByMatch({
        date: '2026-01-18',
        competition: ['BL1'],
        channel: [STRATEGY_CHANNEL.VALUE],
      });

      // Day range + filters forwarded.
      const [filters] = findByDate.mock.calls[0];
      expect(filters.competition).toEqual(['BL1']);
      expect(filters.channel).toEqual([STRATEGY_CHANNEL.VALUE]);
      expect(filters.range.gte.toISOString()).toBe('2026-01-18T00:00:00.000Z');

      // Both decisions belong to the same fixture → one match group.
      expect(groups).toHaveLength(1);
      const match = groups[0];
      expect(match?.homeTeam).toBe('Home');
      expect(match?.awayTeam).toBe('Away');
      expect(match?.homeLogo).toBe('https://logo/home.png');
      expect(match?.country).toBe('Germany');
      expect(match?.score).toBe('2-1');
      expect(match?.htScore).toBe('1-0');
      expect(match?.decisions).toHaveLength(2);

      const ev = match?.decisions[0];
      expect(ev?.selections[0]?.probability).toBe(0.6);
      expect(ev?.selections[0]?.ev).toBe(0.14);
      expect(ev?.selections[0]?.impliedProbability).toBeNull();
      expect(ev?.selections[0]?.result).toBe(BetStatus.WON);

      // REJECTED decision is exposed with its reasonCode and no selections.
      const safe = match?.decisions[1];
      expect(safe?.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
      expect(safe?.reasonCode).toBe('no_safe_candidate');
      expect(safe?.selections).toHaveLength(0);
    });
  });

  describe('listByChannel', () => {
    // Regression test (2026-07-19): READ_CHANNEL_ORDER is a hardcoded list
    // that groups.get(channel) is read against — a channel missing from it
    // is silently dropped from the "Par canal" web lens, not an error. This
    // already happened once for CORRECT_SCORE, then again for
    // CLEAN_SHEET/TEAM_TOTAL/WIN_EITHER_HALF. VANTAGE is intentionally NOT
    // in this list (nor in `channels` below) — it has its own dedicated page
    // now (see READ_CHANNEL_ORDER's comment), this is a deliberate exclusion
    // rather than a recurrence of the bug this test guards against.
    it('includes every primary and meta channel, not just the original six', async () => {
      const baseRow = {
        id: 'cd',
        modelRunId: 'run-1',
        status: CHANNEL_DECISION_STATUS.SELECTED,
        reasonCode: null,
        fixtureId: 'f1',
        createdAt: new Date('2026-01-18T13:00:00.000Z'),
        scheduledAt: new Date('2026-01-18T14:00:00.000Z'),
        homeTeam: 'Home',
        awayTeam: 'Away',
        homeLogo: null,
        awayLogo: null,
        competitionCode: 'BL1',
        country: 'Germany',
        homeScore: null,
        awayScore: null,
        homeHtScore: null,
        awayHtScore: null,
        selections: [],
      };
      const channels = [
        STRATEGY_CHANNEL.VALUE,
        STRATEGY_CHANNEL.SAFE,
        STRATEGY_CHANNEL.DOMINANT,
        STRATEGY_CHANNEL.BTTS,
        STRATEGY_CHANNEL.DRAW,
        STRATEGY_CHANNEL.GOALS,
        STRATEGY_CHANNEL.CLEAN_SHEET,
        STRATEGY_CHANNEL.TEAM_TOTAL,
        STRATEGY_CHANNEL.WIN_EITHER_HALF,
        STRATEGY_CHANNEL.CORRECT_SCORE,
        STRATEGY_CHANNEL.AVOID,
        STRATEGY_CHANNEL.CONSENSUS,
      ];
      const findByDate = vi.fn().mockResolvedValue(
        channels.map((channel, i) => ({
          ...baseRow,
          id: `cd-${i}`,
          channel,
        })),
      );
      const findNewCoachTeams = vi.fn().mockResolvedValue(new Set());
      const repo = {
        findByDate,
        findNewCoachTeams,
      } as unknown as ChannelDecisionRepository;
      const service = new ChannelDecisionService(repo);

      const groups = await service.listByChannel({ date: '2026-01-18' });

      expect(groups.map((g) => g.channel).sort()).toEqual([...channels].sort());
    });

    // VANTAGE has its own dedicated page (apps/web's /dashboard/arbitrage) —
    // it must never resurface on "Par canal" even when the raw rows contain
    // it, so a future accidental re-add to READ_CHANNEL_ORDER is the only
    // thing that could break this, not silence.
    it('drops VANTAGE even when present in the raw rows', async () => {
      const baseRow = {
        id: 'cd',
        modelRunId: 'run-1',
        status: CHANNEL_DECISION_STATUS.SELECTED,
        reasonCode: null,
        fixtureId: 'f1',
        createdAt: new Date('2026-01-18T13:00:00.000Z'),
        scheduledAt: new Date('2026-01-18T14:00:00.000Z'),
        homeTeam: 'Home',
        awayTeam: 'Away',
        homeLogo: null,
        awayLogo: null,
        competitionCode: 'BL1',
        country: 'Germany',
        homeScore: null,
        awayScore: null,
        homeHtScore: null,
        awayHtScore: null,
        selections: [],
      };
      const findByDate = vi.fn().mockResolvedValue([
        { ...baseRow, id: 'cd-1', channel: STRATEGY_CHANNEL.DOMINANT },
        { ...baseRow, id: 'cd-2', channel: STRATEGY_CHANNEL.VANTAGE },
      ]);
      const repo = {
        findByDate,
        findNewCoachTeams: vi.fn().mockResolvedValue(new Set()),
      } as unknown as ChannelDecisionRepository;
      const service = new ChannelDecisionService(repo);

      const groups = await service.listByChannel({ date: '2026-01-18' });

      expect(groups.map((g) => g.channel)).not.toContain(
        STRATEGY_CHANNEL.VANTAGE,
      );
      expect(groups.map((g) => g.channel)).toContain(STRATEGY_CHANNEL.DOMINANT);
    });
  });

  describe('getFacets', () => {
    it('resolves the date into a UTC day range and aggregates leagues + channels with counts', async () => {
      const findFacetRows = vi.fn().mockResolvedValue([
        {
          channel: STRATEGY_CHANNEL.DRAW,
          code: 'PL',
          name: 'Premier League',
          country: 'England',
        },
        {
          channel: STRATEGY_CHANNEL.BTTS,
          code: 'PL',
          name: 'Premier League',
          country: 'England',
        },
        {
          channel: STRATEGY_CHANNEL.DRAW,
          code: 'BL1',
          name: 'Bundesliga',
          country: 'Germany',
        },
        // CONSENSUS is a meta-channel with no pick of its own (§2bis point 5)
        // — never surfaced as a filterable channel, same exclusion
        // listByChannel already applies via READ_CHANNEL_ORDER.
        {
          channel: STRATEGY_CHANNEL.CONSENSUS,
          code: 'PL',
          name: 'Premier League',
          country: 'England',
        },
      ]);
      const repo = { findFacetRows } as unknown as ChannelDecisionRepository;
      const service = new ChannelDecisionService(repo);

      const result = await service.getFacets('2026-01-18');

      expect(findFacetRows).toHaveBeenCalledTimes(1);
      const [range] = findFacetRows.mock.calls[0];
      expect(range.gte.toISOString()).toBe('2026-01-18T00:00:00.000Z');
      expect(range.lte.toISOString()).toBe('2026-01-18T23:59:59.999Z');

      expect(result.leagues).toEqual([
        { code: 'BL1', name: 'Bundesliga', country: 'Germany', count: 1 },
        { code: 'PL', name: 'Premier League', country: 'England', count: 3 },
      ]);
      expect(result.channels).toEqual(
        expect.arrayContaining([
          { channel: STRATEGY_CHANNEL.DRAW, count: 2 },
          { channel: STRATEGY_CHANNEL.BTTS, count: 1 },
        ]),
      );
      expect(
        result.channels.some((c) => c.channel === STRATEGY_CHANNEL.CONSENSUS),
      ).toBe(false);
    });
  });
});
