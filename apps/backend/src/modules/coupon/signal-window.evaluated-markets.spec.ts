import { describe, it, expect } from 'vitest';
import { resolveEvaluatedMarketLeg } from './signal-window.service';

// resolveEvaluatedMarketLeg decides whether a ModelRun.features.evaluatedPicks
// entry becomes an extra coupon candidate (opts.includeEvaluatedMarkets) —
// see EVALUATED_MARKET_CANAL doc (coupon.constants.ts) for why a 'viable'
// entry not officially staked by its own channel is a legitimate candidate,
// not a reliability rejection. This closes the structural gap found
// 2026-08-16: the real coupon pool (getPoolForRange) only ever read one
// already-staked Bet/channelDecision per channel per fixture, never the full
// per-fixture market evaluation — exactly the "selectedPicks vs evaluatedPicks"
// gap COUPON_ANALYSIS_TEMPLATE.md documents for manual analysis.
function makeEvaluated(overrides: {
  market: string;
  pick?: string;
  status?: 'viable' | 'rejected';
  probability?: string;
  odds?: string;
}) {
  return {
    market: overrides.market,
    pick: overrides.pick ?? 'HOME',
    status: overrides.status ?? 'viable',
    probability: overrides.probability ?? '0.7000',
    odds: overrides.odds ?? '1.80',
  };
}

const baseOpts = {
  stakedKeys: new Set<string>(),
  enforceAvoid: false,
  calibrationAlert: false,
};

describe('resolveEvaluatedMarketLeg', () => {
  it('excludes rejected picks', () => {
    const evaluated = makeEvaluated({
      market: 'ONE_X_TWO',
      status: 'rejected',
    });
    expect(resolveEvaluatedMarketLeg(evaluated, baseOpts)).toBeNull();
  });

  it('excludes unmapped markets (e.g. CORRECT_SCORE — immature signal, see TODO.md)', () => {
    const evaluated = makeEvaluated({ market: 'CORRECT_SCORE', pick: '1-0' });
    expect(resolveEvaluatedMarketLeg(evaluated, baseOpts)).toBeNull();
  });

  it('excludes a pick already staked for this fixture (dedup)', () => {
    const evaluated = makeEvaluated({ market: 'DOUBLE_CHANCE', pick: '1X' });
    const opts = { ...baseOpts, stakedKeys: new Set(['DOUBLE_CHANCE:1X']) };
    expect(resolveEvaluatedMarketLeg(evaluated, opts)).toBeNull();
  });

  it('maps ONE_X_TWO to DOMINANT (never otherwise read into the real pool)', () => {
    const evaluated = makeEvaluated({ market: 'ONE_X_TWO', pick: 'HOME' });
    expect(resolveEvaluatedMarketLeg(evaluated, baseOpts)).toEqual({
      canal: 'DOMINANT',
      probability: 0.7,
      oddsSnapshot: 1.8,
    });
  });

  it('maps each market to its own specialist channel, not to VALUE', () => {
    const cases: Array<[string, string, string]> = [
      ['DOUBLE_CHANCE', '1X', 'DOUBLE_CHANCE'],
      ['DRAW_NO_BET', 'HOME', 'DRAW_NO_BET'],
      ['HALF_TIME_FULL_TIME', 'HOME_HOME', 'HALF_TIME_FULL_TIME'],
      ['FIRST_HALF_WINNER', 'HOME', 'FIRST_HALF'],
      ['TO_WIN_EITHER_HALF', 'HOME', 'WIN_EITHER_HALF'],
      ['WIN_TO_NIL_HOME', 'YES', 'WIN_TO_NIL'],
      ['WIN_TO_NIL_AWAY', 'YES', 'WIN_TO_NIL'],
    ];
    for (const [market, pick, canal] of cases) {
      const evaluated = makeEvaluated({ market, pick });
      expect(resolveEvaluatedMarketLeg(evaluated, baseOpts)?.canal).toBe(canal);
    }
  });

  // The evaluatedPicks path resolves each market to the channel that owns it,
  // and drops what it cannot resolve — so an evaluated pick can never enter
  // the pool wearing a channel label that is not its own.
  it('routes every mapped market to its own owning channel', () => {
    const cases: Array<[string, string, string]> = [
      ['OVER_UNDER', 'OVER_2_5', 'GOALS'],
      ['BTTS', 'YES', 'BTTS'],
      ['TEAM_TOTAL_HOME', 'OVER_1_5', 'TEAM_TOTAL'],
      ['CLEAN_SHEET_HOME', 'YES', 'CLEAN_SHEET'],
      ['RESULT_BTTS', 'HOME_YES', 'RESULT_BTTS'],
    ];
    for (const [market, pick, canal] of cases) {
      expect(
        resolveEvaluatedMarketLeg(makeEvaluated({ market, pick }), baseOpts)
          ?.canal,
      ).toBe(canal);
    }
  });

  it('drops a market with no owning channel (CORRECT_SCORE — signal validated for reasonDetails only)', () => {
    const evaluated = makeEvaluated({ market: 'CORRECT_SCORE', pick: '2-1' });
    expect(resolveEvaluatedMarketLeg(evaluated, baseOpts)).toBeNull();
  });

  it('parses string probability/odds into numbers', () => {
    const evaluated = makeEvaluated({
      market: 'DRAW_NO_BET',
      pick: 'HOME',
      probability: '0.6234',
      odds: '2.10',
    });
    expect(resolveEvaluatedMarketLeg(evaluated, baseOpts)).toEqual({
      canal: 'DRAW_NO_BET',
      probability: 0.6234,
      oddsSnapshot: 2.1,
    });
  });

  it('excludes a leg with extreme model↔market divergence alone (FADE regime — no opposite-leg construction here, treated like DROP)', () => {
    // 0.90 - 1/2.50 = 0.50 ≥ AVOID_CONFIG.maxEdge (0.30) → FADE
    const evaluated = makeEvaluated({
      market: 'DRAW_NO_BET',
      pick: 'HOME',
      probability: '0.9000',
      odds: '2.50',
    });
    const opts = { ...baseOpts, enforceAvoid: true, calibrationAlert: false };
    expect(resolveEvaluatedMarketLeg(evaluated, opts)).toBeNull();
  });

  it('excludes a leg with a calibration alert alone (DROP regime)', () => {
    const evaluated = makeEvaluated({
      market: 'DRAW_NO_BET',
      pick: 'HOME',
      probability: '0.6000',
      odds: '1.90',
    });
    const opts = { ...baseOpts, enforceAvoid: true, calibrationAlert: true };
    expect(resolveEvaluatedMarketLeg(evaluated, opts)).toBeNull();
  });

  it('keeps a KEEP-regime leg (both extreme divergence and calibration alert) even with AVOID enforced', () => {
    const evaluated = makeEvaluated({
      market: 'DRAW_NO_BET',
      pick: 'HOME',
      probability: '0.9000',
      odds: '2.50',
    });
    const opts = { ...baseOpts, enforceAvoid: true, calibrationAlert: true };
    expect(resolveEvaluatedMarketLeg(evaluated, opts)).not.toBeNull();
  });
});
