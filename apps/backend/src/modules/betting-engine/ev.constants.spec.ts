import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  EV_THRESHOLD,
  getLeagueEvThreshold,
  getLeagueHomeAwayFactors,
  getLeagueMinSelectionOdds,
  getPickDirectionProbabilityThreshold,
  getPickEvFloor,
  getPickMaxSelectionOdds,
  getPickMinSelectionOdds,
  MIN_DRAW_DIRECTION_PROBABILITY,
} from './ev.constants';

describe('getLeagueEvThreshold', () => {
  it('returns EV_THRESHOLD for top-tier leagues not in the override map', () => {
    expect(getLeagueEvThreshold('PL').toNumber()).toBe(EV_THRESHOLD.toNumber());
    expect(getLeagueEvThreshold('BL1').toNumber()).toBe(
      EV_THRESHOLD.toNumber(),
    );
    expect(getLeagueEvThreshold('LL').toNumber()).toBe(EV_THRESHOLD.toNumber());
  });

  it('returns EV_THRESHOLD for null competition code', () => {
    expect(getLeagueEvThreshold(null).toNumber()).toBe(EV_THRESHOLD.toNumber());
  });

  it('returns raised threshold for FRI (sparse xG coverage)', () => {
    const threshold = getLeagueEvThreshold('FRI');
    expect(threshold.greaterThan(EV_THRESHOLD)).toBe(true);
    expect(threshold.toNumber()).toBe(0.15);
  });

  it('returns raised threshold for WCQE', () => {
    const threshold = getLeagueEvThreshold('WCQE');
    expect(threshold.greaterThan(EV_THRESHOLD)).toBe(true);
    expect(threshold.toNumber()).toBe(0.15);
  });

  it('returns raised threshold for EL2', () => {
    const threshold = getLeagueEvThreshold('EL2');
    expect(threshold.greaterThan(EV_THRESHOLD)).toBe(true);
    expect(threshold.toNumber()).toBe(0.1);
  });

  it('returns raised threshold for F2', () => {
    const threshold = getLeagueEvThreshold('F2');
    expect(threshold.greaterThan(EV_THRESHOLD)).toBe(true);
    expect(threshold.toNumber()).toBe(0.1);
  });

  it('returns EV_THRESHOLD for unknown competition code', () => {
    expect(getLeagueEvThreshold('UNKNOWN').toNumber()).toBe(
      EV_THRESHOLD.toNumber(),
    );
  });
});

describe('MIN_DRAW_DIRECTION_PROBABILITY', () => {
  it('is above 0 and below MIN_PICK_DIRECTION_PROBABILITY (0.45)', () => {
    expect(MIN_DRAW_DIRECTION_PROBABILITY.greaterThan(0)).toBe(true);
    expect(MIN_DRAW_DIRECTION_PROBABILITY.lessThan(new Decimal('0.45'))).toBe(
      true,
    );
  });
});

describe('getPickDirectionProbabilityThreshold', () => {
  it('returns the tightened D2 AWAY override', () => {
    expect(
      getPickDirectionProbabilityThreshold('D2', 'ONE_X_TWO', 'AWAY').toNumber(),
    ).toBe(0.42);
  });
});

describe('getPickMinSelectionOdds', () => {
  it('keeps the broad Bundesliga floor at 2.00', () => {
    expect(getLeagueMinSelectionOdds('BL1').toNumber()).toBe(2);
    expect(getPickMinSelectionOdds('BL1', 'ONE_X_TWO', 'DRAW').toNumber()).toBe(
      2,
    );
  });

  it('raises the floor to 5.00 for Bundesliga 1X2 HOME picks', () => {
    expect(getPickMinSelectionOdds('BL1', 'ONE_X_TWO', 'HOME').toNumber()).toBe(
      5,
    );
  });

  it('raises the floor to 5.00 for PL 1X2 DRAW picks', () => {
    // Audit 2026-04-04: [3.0–4.99] −3.0% ROI; [>=5.0] +29.8% ROI.
    // Creates [5.00, 5.50) window (ceiling set via getPickMaxSelectionOdds).
    expect(getPickMinSelectionOdds('PL', 'ONE_X_TWO', 'DRAW').toNumber()).toBe(
      5,
    );
  });

  it('raises the floor to 5.00 for Championship 1X2 HOME picks', () => {
    expect(getPickMinSelectionOdds('CH', 'ONE_X_TWO', 'HOME').toNumber()).toBe(
      5,
    );
  });

  it('raises the floor to 3.00 for D2 1X2 HOME picks', () => {
    expect(getPickMinSelectionOdds('D2', 'ONE_X_TWO', 'HOME').toNumber()).toBe(
      3,
    );
  });

  it('keeps the league floor for CH 1X2 DRAW', () => {
    expect(getPickMinSelectionOdds('CH', 'ONE_X_TWO', 'DRAW').toNumber()).toBe(
      2.1,
    );
  });

  it('raises the floor to 3.50 for Championship 1X2 AWAY picks', () => {
    // Audit 2026-04-04: CH AWAY placed was -15.9% ROI; only marginal signal
    // at odds >= 3.5 (N=3). Kept below the stricter CH HOME floor (5.00).
    expect(getPickMinSelectionOdds('CH', 'ONE_X_TWO', 'AWAY').toNumber()).toBe(
      3.5,
    );
  });
});

describe('getPickMaxSelectionOdds', () => {
  it('returns null for picks with no ceiling override', () => {
    expect(getPickMaxSelectionOdds('PL', 'ONE_X_TWO', 'HOME')).toBeNull();
    expect(getPickMaxSelectionOdds('EL2', 'ONE_X_TWO', 'AWAY')).toBeNull();
    expect(getPickMaxSelectionOdds(null, 'ONE_X_TWO', 'DRAW')).toBeNull();
  });

  it('returns 1.95 ceiling for SP2 1X2 HOME', () => {
    expect(
      getPickMaxSelectionOdds('SP2', 'ONE_X_TWO', 'HOME')?.toNumber(),
    ).toBe(1.95);
  });

  it('returns 5.50 ceiling for PL 1X2 DRAW — raises the global 4.0 cap', () => {
    // Audit 2026-04-04: 164 rejected PL DRAW cases (odds > 4.0) showed sim
    // ROI +17.1%. Per-pick ceiling replaces the global MAX_SELECTION_ODDS cap.
    expect(getPickMaxSelectionOdds('PL', 'ONE_X_TWO', 'DRAW')?.toNumber()).toBe(
      5.5,
    );
  });

  it('returns 2.99 ceiling for D2 1X2 AWAY', () => {
    expect(getPickMaxSelectionOdds('D2', 'ONE_X_TWO', 'AWAY')?.toNumber()).toBe(
      2.99,
    );
  });
});

describe('getLeagueHomeAwayFactors', () => {
  it('returns the reduced home-advantage override for D2', () => {
    expect(getLeagueHomeAwayFactors('D2')).toEqual([1.02, 0.98]);
  });
});

describe('getPickEvFloor', () => {
  it('returns a stronger EV floor for D2 1X2 HOME', () => {
    expect(
      getPickEvFloor('D2', 'ONE_X_TWO', 'HOME', new Decimal('0.08')).toNumber(),
    ).toBe(0.12);
  });
});
