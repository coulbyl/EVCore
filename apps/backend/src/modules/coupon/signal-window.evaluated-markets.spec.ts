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
    const evaluated = makeEvaluated({ market: 'BTTS', pick: 'YES' });
    const opts = { ...baseOpts, stakedKeys: new Set(['BTTS:YES']) };
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

  it('maps TEAM_TOTAL_HOME/AWAY to TEAM_TOTAL', () => {
    const home = makeEvaluated({ market: 'TEAM_TOTAL_HOME', pick: 'OVER_1_5' });
    const away = makeEvaluated({
      market: 'TEAM_TOTAL_AWAY',
      pick: 'UNDER_1_5',
    });
    expect(resolveEvaluatedMarketLeg(home, baseOpts)?.canal).toBe('TEAM_TOTAL');
    expect(resolveEvaluatedMarketLeg(away, baseOpts)?.canal).toBe('TEAM_TOTAL');
  });

  it('maps everything else (e.g. OVER_UNDER, CLEAN_SHEET_HOME) to VALUE', () => {
    const overUnder = makeEvaluated({ market: 'OVER_UNDER', pick: 'OVER_2_5' });
    const cleanSheet = makeEvaluated({
      market: 'CLEAN_SHEET_HOME',
      pick: 'YES',
    });
    expect(resolveEvaluatedMarketLeg(overUnder, baseOpts)?.canal).toBe('VALUE');
    expect(resolveEvaluatedMarketLeg(cleanSheet, baseOpts)?.canal).toBe(
      'VALUE',
    );
  });

  it('parses string probability/odds into numbers', () => {
    const evaluated = makeEvaluated({
      market: 'BTTS',
      pick: 'YES',
      probability: '0.6234',
      odds: '2.10',
    });
    expect(resolveEvaluatedMarketLeg(evaluated, baseOpts)).toEqual({
      canal: 'BTTS',
      probability: 0.6234,
      oddsSnapshot: 2.1,
    });
  });

  it('excludes a leg with extreme model↔market divergence alone (FADE regime — no opposite-leg construction here, treated like DROP)', () => {
    // 0.90 - 1/2.50 = 0.50 ≥ AVOID_CONFIG.maxEdge (0.30) → FADE
    const evaluated = makeEvaluated({
      market: 'BTTS',
      pick: 'YES',
      probability: '0.9000',
      odds: '2.50',
    });
    const opts = { ...baseOpts, enforceAvoid: true, calibrationAlert: false };
    expect(resolveEvaluatedMarketLeg(evaluated, opts)).toBeNull();
  });

  it('excludes a leg with a calibration alert alone (DROP regime)', () => {
    const evaluated = makeEvaluated({
      market: 'BTTS',
      pick: 'YES',
      probability: '0.6000',
      odds: '1.90',
    });
    const opts = { ...baseOpts, enforceAvoid: true, calibrationAlert: true };
    expect(resolveEvaluatedMarketLeg(evaluated, opts)).toBeNull();
  });

  it('keeps a KEEP-regime leg (both extreme divergence and calibration alert) even with AVOID enforced', () => {
    const evaluated = makeEvaluated({
      market: 'BTTS',
      pick: 'YES',
      probability: '0.9000',
      odds: '2.50',
    });
    const opts = { ...baseOpts, enforceAvoid: true, calibrationAlert: true };
    expect(resolveEvaluatedMarketLeg(evaluated, opts)).not.toBeNull();
  });
});
