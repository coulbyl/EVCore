import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  EV_THRESHOLD,
  getLeagueEvThreshold,
  getLeagueMinSelectionOdds,
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

describe('getPickMinSelectionOdds', () => {
  it('keeps the broad Bundesliga floor at 2.00', () => {
    expect(getLeagueMinSelectionOdds('BL1').toNumber()).toBe(2);
    expect(getPickMinSelectionOdds('BL1', 'ONE_X_TWO', 'DRAW').toNumber()).toBe(
      2,
    );
  });

  it('raises the floor to 3.00 for Bundesliga 1X2 HOME picks', () => {
    expect(getPickMinSelectionOdds('BL1', 'ONE_X_TWO', 'HOME').toNumber()).toBe(
      3,
    );
  });

  it('raises the floor to 3.00 for Championship 1X2 HOME picks', () => {
    expect(
      getPickMinSelectionOdds('CH', 'ONE_X_TWO', 'HOME').toNumber(),
    ).toBe(3);
  });

  it('keeps the league floor for other Championship 1X2 picks', () => {
    expect(
      getPickMinSelectionOdds('CH', 'ONE_X_TWO', 'DRAW').toNumber(),
    ).toBe(2.1);
    expect(
      getPickMinSelectionOdds('CH', 'ONE_X_TWO', 'AWAY').toNumber(),
    ).toBe(2.1);
  });
});
