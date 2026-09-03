import { describe, it, expect } from 'vitest';
import { resolveEvaluatedMarketLeg } from './coupon-pool.service';

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
  rejectionReason?: string;
}) {
  return {
    market: overrides.market,
    pick: overrides.pick ?? 'HOME',
    status: overrides.status ?? 'viable',
    probability: overrides.probability ?? '0.7000',
    odds: overrides.odds ?? '1.80',
    ...(overrides.rejectionReason !== undefined
      ? { rejectionReason: overrides.rejectionReason }
      : {}),
  };
}

const baseOpts = {
  stakedKeys: new Set<string>(),
  enforceAvoid: false,
  calibrationAlert: false,
};

describe('resolveEvaluatedMarketLeg', () => {
  it('excludes rejected picks by default (includeEvRejected off)', () => {
    const evaluated = makeEvaluated({
      market: 'ONE_X_TWO',
      status: 'rejected',
      rejectionReason: 'ev_below_threshold',
    });
    expect(resolveEvaluatedMarketLeg(evaluated, baseOpts)).toBeNull();
  });

  it('excludes a reliability-rejected pick even with includeEvRejected on', () => {
    const evaluated = makeEvaluated({
      market: 'ONE_X_TWO',
      status: 'rejected',
      rejectionReason: 'probability_too_low',
    });
    const opts = { ...baseOpts, includeEvRejected: true };
    expect(resolveEvaluatedMarketLeg(evaluated, opts)).toBeNull();
  });

  it('excludes a rejected pick with no recorded reason even with includeEvRejected on (conservative default)', () => {
    const evaluated = makeEvaluated({
      market: 'ONE_X_TWO',
      status: 'rejected',
    });
    const opts = { ...baseOpts, includeEvRejected: true };
    expect(resolveEvaluatedMarketLeg(evaluated, opts)).toBeNull();
  });

  it('admits an EV/odds-rejected pick when includeEvRejected is on (COUPON_ANALYSIS_TEMPLATE.md Étape 0: not a reliability rejection)', () => {
    const evaluated = makeEvaluated({
      market: 'ONE_X_TWO',
      status: 'rejected',
      rejectionReason: 'ev_below_threshold',
    });
    const opts = { ...baseOpts, includeEvRejected: true };
    const resolved = resolveEvaluatedMarketLeg(evaluated, opts);
    expect(resolved).not.toBeNull();
    expect(resolved?.wasViable).toBe(false);
  });

  for (const reason of [
    'probability_too_low',
    'quality_score_below_threshold',
    'under_high_lambda',
    'market_suspended',
  ]) {
    it(`still excludes a "${reason}" rejection with includeEvRejected on — reliability, not EV/odds`, () => {
      const evaluated = makeEvaluated({
        market: 'ONE_X_TWO',
        status: 'rejected',
        rejectionReason: reason,
      });
      const opts = { ...baseOpts, includeEvRejected: true };
      expect(resolveEvaluatedMarketLeg(evaluated, opts)).toBeNull();
    });
  }

  for (const reason of [
    'ev_above_hard_cap',
    'ev_above_soft_cap',
    'ev_below_threshold',
    'odds_below_floor',
    'odds_above_cap',
  ]) {
    it(`admits an "${reason}" rejection with includeEvRejected on — EV/odds, not reliability`, () => {
      const evaluated = makeEvaluated({
        market: 'ONE_X_TWO',
        status: 'rejected',
        rejectionReason: reason,
      });
      const opts = { ...baseOpts, includeEvRejected: true };
      expect(resolveEvaluatedMarketLeg(evaluated, opts)).not.toBeNull();
    });
  }

  it('tags a viable pick as wasViable: true', () => {
    const evaluated = makeEvaluated({ market: 'ONE_X_TWO' });
    expect(resolveEvaluatedMarketLeg(evaluated, baseOpts)?.wasViable).toBe(
      true,
    );
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
      wasViable: true,
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
      wasViable: true,
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
