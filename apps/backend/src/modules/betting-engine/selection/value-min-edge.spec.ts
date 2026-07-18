import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  selectBestViablePick,
  computePoissonMarkets,
  buildPoissonDistributions,
  type FullOddsSnapshot,
  type MatchProbabilities,
  type SelectionConfig,
} from '@evcore/analysis-core';
import { getValueMinEdge } from '../ev.constants';

// Strong-home fixture with generous home odds → the model's HOME pick carries a
// large real edge (≈ 0.18), well above the VALUE_MIN_EDGE floor.
const LAMBDA_HOME = 1.9;
const LAMBDA_AWAY = 0.8;

const ODDS: FullOddsSnapshot = {
  bookmaker: 'Pinnacle',
  snapshotAt: new Date(),
  homeOdds: new Decimal('2.20'),
  drawOdds: new Decimal('4.0'),
  awayOdds: new Decimal('6.0'),
  overUnderOdds: {},
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

// Minimal permissive config so the test isolates the edge gate (the per-league
// override values are validated separately via getValueMinEdge below).
function makeConfig(valueMinEdge: Decimal | undefined): SelectionConfig {
  return {
    leagueEvThreshold: new Decimal('0.08'),
    valueMinEdge,
    svMinProbability: new Decimal('0.68'),
    svMinOdds: new Decimal('1.15'),
    htftCalibrated: false,
    pickDirectionProbabilityThreshold: () => new Decimal('0.45'),
    pickEvFloor: (_m, _p, leagueFloor) => leagueFloor,
    pickEvSoftCap: () => new Decimal('0.90'),
    pickMinSelectionOdds: () => new Decimal('1.15'),
    pickMaxSelectionOdds: () => null,
  };
}

function run(valueMinEdge: Decimal | undefined) {
  const probabilities = computePoissonMarkets(
    LAMBDA_HOME,
    LAMBDA_AWAY,
  ) as unknown as MatchProbabilities;
  const { distHome, distAway } = buildPoissonDistributions(
    LAMBDA_HOME,
    LAMBDA_AWAY,
  );
  return selectBestViablePick(
    probabilities,
    ODDS,
    new Decimal('0.7'),
    distHome,
    distAway,
    false,
    new Set(),
    makeConfig(valueMinEdge),
  );
}

describe('VALUE min-edge gate (selectBestViablePick)', () => {
  it('selects the high-edge pick when the edge floor is permissive', () => {
    const pick = run(new Decimal('0'));
    expect(pick).not.toBeNull();
    // The selected pick must genuinely clear the edge it was let through on.
    const edge = pick!.probability.minus(new Decimal(1).div(pick!.odds));
    expect(edge.greaterThan(0.1)).toBe(true);
  });

  it('suspends VALUE when the league edge floor is unreachable (≥ 1)', () => {
    // Same inputs, but an unreachable edge floor (the suspension sentinel) must
    // yield no VALUE pick at all.
    expect(run(new Decimal('1'))).toBeNull();
  });

  it('applies the default floor (0.10) when the league sets none', () => {
    // undefined → core falls back to VALUE_MIN_EDGE; the high-edge pick survives.
    expect(run(undefined)).not.toBeNull();
  });
});

describe('getValueMinEdge — per-league VALUE suspension', () => {
  it('suspends the structurally uninformative leagues with an unreachable edge', () => {
    // FRI (friendlies) — no reliable xG, model 1X2 calibration FAILs.
    expect(getValueMinEdge('FRI')?.greaterThanOrEqualTo(1)).toBe(true);
  });

  it('leaves other leagues on the core default (undefined)', () => {
    // SA/SWE1 are NOT suspended — their old losses were an older model version;
    // the recent window is healthy (SA model calErr 0.010).
    for (const code of ['BL1', 'PL', 'BRA1', 'WC', 'SA', 'SWE1', null]) {
      expect(getValueMinEdge(code)).toBeUndefined();
    }
  });
});
