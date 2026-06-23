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
  overUnderOdds: {},
  bttsYesOdds: null,
  bttsNoOdds: null,
  htftOdds: {},
  ouHtOdds: {},
  firstHalfWinnerOdds: null,
  doubleChanceOdds: null,
};

function richContext(): StrategyContext {
  const evPick: EvaluatedPick = {
    market: Market.ONE_X_TWO,
    pick: 'HOME',
    probability: new Decimal('0.60'),
    odds: new Decimal('1.90'),
    ev: new Decimal('0.14'),
    qualityScore: new Decimal('0.20'),
    isCombo: false,
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
      home: new Decimal('0.60'),
      draw: new Decimal('0.25'),
      away: new Decimal('0.15'),
      bttsYes: new Decimal('0.65'),
      bttsNo: new Decimal('0.35'),
      over25: new Decimal('0.40'),
      under25: new Decimal('0.60'),
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

    // Orchestrator ran every primary strategy + the CONSENSUS & AVOID meta-strategies.
    expect(evaluated).toHaveLength(8);
    const ev = evaluated.find(
      (d: { channel: string }) => d.channel === STRATEGY_CHANNEL.VALUE,
    );
    expect(ev?.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(ev?.selections[0]?.pick).toBe('HOME');

    // GOALS BL1 OVER is enabled (observation) @ 0.50; over25 here is 0.40 < 0.50
    // → it evaluates but clears no side → REJECTED (not DISABLED).
    const goals = evaluated.find(
      (d: { channel: string }) => d.channel === STRATEGY_CHANNEL.GOALS,
    );
    expect(goals?.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);

    // CONSENSUS (phase 2) fires: DOMINANT (directional) + VALUE (value) both
    // selected HOME → two independent classes agree → SELECTED HOME.
    const consensus = evaluated.find(
      (d: { channel: string }) => d.channel === STRATEGY_CHANNEL.CONSENSUS,
    );
    expect(consensus?.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(consensus?.selections[0]?.pick).toBe('HOME');

    // AVOID (phase 2): the HOME pick edge (0.60 − 1/1.90 ≈ 0.07) is nowhere near
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
          comboMarket: null,
          comboPick: null,
        },
        {
          id: 's2',
          market: Market.ONE_X_TWO,
          pick: 'AWAY',
          comboMarket: null,
          comboPick: null,
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
          comboMarket: null,
          comboPick: null,
        },
        // 1X2 never early-settles → skipped
        {
          id: 'x12',
          market: Market.ONE_X_TWO,
          pick: 'HOME',
          comboMarket: null,
          comboPick: null,
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

  describe('list', () => {
    it('maps read rows to normalised DTOs and forwards filters', async () => {
      const findByDate = vi.fn().mockResolvedValue([
        {
          id: 'cd-ev',
          modelRunId: 'run-1',
          channel: STRATEGY_CHANNEL.VALUE,
          status: CHANNEL_DECISION_STATUS.SELECTED,
          reasonCode: null,
          fixtureId: 'f1',
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
              comboMarket: null,
              comboPick: null,
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
      const repo = { findByDate } as unknown as ChannelDecisionRepository;
      const service = new ChannelDecisionService(repo);

      const items = await service.list({
        date: '2026-01-18',
        competition: 'BL1',
        channel: STRATEGY_CHANNEL.VALUE,
      });

      // Day range + filters forwarded.
      const [filters] = findByDate.mock.calls[0];
      expect(filters.competition).toBe('BL1');
      expect(filters.channel).toBe(STRATEGY_CHANNEL.VALUE);
      expect(filters.range.gte.toISOString()).toBe('2026-01-18T00:00:00.000Z');

      expect(items).toHaveLength(2);
      const ev = items[0];
      expect(ev?.homeTeam).toBe('Home');
      expect(ev?.awayTeam).toBe('Away');
      expect(ev?.homeLogo).toBe('https://logo/home.png');
      expect(ev?.country).toBe('Germany');
      expect(ev?.score).toBe('2-1');
      expect(ev?.htScore).toBe('1-0');
      expect(ev?.selections[0]?.probability).toBe(0.6);
      expect(ev?.selections[0]?.ev).toBe(0.14);
      expect(ev?.selections[0]?.impliedProbability).toBeNull();
      expect(ev?.selections[0]?.result).toBe(BetStatus.WON);

      // REJECTED decision is exposed with its reasonCode and no selections.
      const safe = items[1];
      expect(safe?.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
      expect(safe?.reasonCode).toBe('no_safe_candidate');
      expect(safe?.selections).toHaveLength(0);
    });
  });
});
