import Decimal from 'decimal.js';
import { Market } from '../types';
import { HALF_TIME_FULL_TIME_PICKS, computeJointProbability } from '../probability';
import { calculateEV as calcEV } from '../ev/ev-math';
import {
  buildBetPickKey,
  getPickOddsFromSnapshot,
  estimateComboOdds,
  COMBO_WHITELIST,
} from './combo-pricing';
import {
  COMBOS_ENABLED,
  EV_HARD_CAP,
  FALLBACK_MIN_QUALITY_SCORE,
  MAX_SELECTION_ODDS,
  SAFE_VALUE_MAX_ODDS,
  SAFE_VALUE_MIN_EV,
  SV_UNDER_LAMBDA_COMPARISON_THRESHOLD,
} from './constants';
import { buildQualityScore, getPickRejectionReason } from './pick-validation';
import type { SelectionConfig } from './config';
import type { EvaluatedPick, FullOddsSnapshot, MatchProbabilities, ViablePick } from './types';

// Select the best safe-value pick from a pre-computed list of evaluated picks.
//
// Safe value criteria (distinct from EV criteria):
//   - Single-market pick only (no combos)
//   - Allowed markets: ONE_X_TWO, OVER_UNDER, BTTS, OVER_UNDER_HT
//   - Probability ≥ SAFE_VALUE_MIN_PROBABILITY (0.68)
//   - EV in [SAFE_VALUE_MIN_EV (0.00), EV_HARD_CAP]
//   - Odds in [SAFE_VALUE_MIN_ODDS (1.15), SAFE_VALUE_MAX_ODDS (2.20)]
//   - Market not suspended
//   - Not already the EV pick (excludedPickKey)
//
// Returns the candidate with the highest probability (then highest EV as tiebreak).
// When the winner is Under 3.5 or Under 4.5 at high lambda, also evaluates the
// symmetric Over counterparts (Over 2.5, Over 3.5) and upgrades to the better
// qualityScore — fixing the structural Under bias at high expected goals (section 7).
export function selectSafeValuePick(
  evaluatedPicks: EvaluatedPick[],
  suspendedMarkets: ReadonlySet<Market>,
  excludedPickKey: string | null,
  lambdaTotal = 0,
  config: SelectionConfig,
): ViablePick | null {
  const safeValueMarkets = new Set<Market>([
    Market.ONE_X_TWO,
    Market.OVER_UNDER,
    Market.BTTS,
    Market.OVER_UNDER_HT,
  ]);

  const svMinProbability = config.svMinProbability;
  const svMinOdds = config.svMinOdds;

  const isEligibleSvPick = (pick: EvaluatedPick): boolean => {
    if (pick.isCombo) return false;
    if (!safeValueMarkets.has(pick.market)) return false;
    if (pick.probability.lessThan(svMinProbability)) return false;
    if (pick.ev.lessThan(SAFE_VALUE_MIN_EV)) return false;
    if (pick.ev.greaterThan(EV_HARD_CAP)) return false;
    if (pick.odds.lessThan(svMinOdds)) return false;
    if (pick.odds.greaterThan(SAFE_VALUE_MAX_ODDS)) return false;
    if (suspendedMarkets.has(pick.market)) return false;
    const pickKey = buildBetPickKey({
      market: pick.market,
      pick: pick.pick,
      comboMarket: pick.comboMarket ?? null,
      comboPick: pick.comboPick ?? null,
    });
    if (excludedPickKey !== null && pickKey === excludedPickKey) return false;
    return true;
  };

  const candidates = evaluatedPicks.filter(isEligibleSvPick);
  if (candidates.length === 0) return null;

  // Best by probability DESC, then EV DESC
  const bestPick = candidates.reduce((best, c) => {
    const cmpProb = c.probability.comparedTo(best.probability);
    if (cmpProb > 0) return c;
    if (cmpProb < 0) return best;
    return c.ev.comparedTo(best.ev) > 0 ? c : best;
  });

  // Symmetric Over/Under comparison at high lambda: when the SV winner is
  // Under 3.5 or Under 4.5, the model is predicting a high-scoring game —
  // Over 2.5 or Over 3.5 may offer better qualityScore at lower but still
  // viable probability. Probability floor is intentionally relaxed here.
  if (
    bestPick.market === Market.OVER_UNDER &&
    (bestPick.pick === 'UNDER_3_5' || bestPick.pick === 'UNDER_4_5') &&
    lambdaTotal >= SV_UNDER_LAMBDA_COMPARISON_THRESHOLD
  ) {
    const overCounterparts = evaluatedPicks.filter(
      (p): p is ViablePick =>
        p.rejectionReason === undefined &&
        !p.isCombo &&
        p.market === Market.OVER_UNDER &&
        (p.pick === 'OVER' || p.pick === 'OVER_3_5') &&
        p.ev.greaterThanOrEqualTo(SAFE_VALUE_MIN_EV) &&
        p.ev.lessThanOrEqualTo(EV_HARD_CAP) &&
        // Per-league floor (svMinOdds), like the main eligibility check —
        // the global SAFE_VALUE_MIN_ODDS here let Over counterparts slip
        // below a league override (e.g. SP2 1.45).
        p.odds.greaterThanOrEqualTo(svMinOdds) &&
        p.odds.lessThanOrEqualTo(SAFE_VALUE_MAX_ODDS) &&
        !suspendedMarkets.has(p.market) &&
        (excludedPickKey === null ||
          buildBetPickKey({
            market: p.market,
            pick: p.pick,
            comboMarket: null,
            comboPick: null,
          }) !== excludedPickKey),
    );

    const bestOver =
      overCounterparts.length > 0
        ? overCounterparts.reduce((a, b) =>
            b.qualityScore.comparedTo(a.qualityScore) > 0 ? b : a,
          )
        : null;

    if (bestOver && bestOver.qualityScore.greaterThan(bestPick.qualityScore)) {
      return bestOver;
    }
  }

  return bestPick;
}

export function selectBestViablePick(
  probabilities: MatchProbabilities,
  odds: FullOddsSnapshot,
  deterministicScore: Decimal,
  distHome: number[],
  distAway: number[],
  lambdaFloorHit: boolean,
  suspendedMarkets: ReadonlySet<Market>,
  config: SelectionConfig,
  overrideMinEv?: Decimal,
): ViablePick | null {
  const evaluated = listEvaluatedPicks(
    probabilities,
    odds,
    deterministicScore,
    distHome,
    distAway,
    lambdaFloorHit,
    suspendedMarkets,
    config,
    overrideMinEv,
  );

  // Detect if the ideal pick (highest qualityScore overall) was rejected.
  // If so, apply a stricter floor to prevent selecting a poor substitute
  // just because it is "best remaining" after the dominant candidate was blocked.
  const topByQuality = evaluated.reduce<(typeof evaluated)[number] | null>(
    (best, p) =>
      best === null || p.qualityScore.greaterThan(best.qualityScore) ? p : best,
    null,
  );
  const primaryWasRejected = topByQuality?.rejectionReason !== undefined;

  const viable = evaluated
    .filter((p): p is ViablePick => p.rejectionReason === undefined)
    .sort((a, b) => b.qualityScore.comparedTo(a.qualityScore));

  if (primaryWasRejected) {
    return (
      viable.find((p) =>
        p.qualityScore.greaterThanOrEqualTo(FALLBACK_MIN_QUALITY_SCORE),
      ) ?? null
    );
  }

  return viable[0] ?? null;
}

export function listEvaluatedOneXTwoPicks(
  probabilities: MatchProbabilities,
  odds: FullOddsSnapshot,
  deterministicScore: Decimal,
  suspendedMarkets: ReadonlySet<Market>,
  config: SelectionConfig,
): EvaluatedPick[] {
  const minEv = config.leagueEvThreshold;
  const candidates: ViablePick[] = [
    {
      market: Market.ONE_X_TWO,
      pick: 'HOME',
      probability: probabilities.home,
      odds: odds.homeOdds,
      ev: calcEV(probabilities.home, odds.homeOdds),
      qualityScore: buildQualityScore(
        calcEV(probabilities.home, odds.homeOdds),
        deterministicScore,
        Market.ONE_X_TWO,
        'HOME',
        odds.homeOdds,
      ),
      isCombo: false,
    },
    {
      market: Market.ONE_X_TWO,
      pick: 'DRAW',
      probability: probabilities.draw,
      odds: odds.drawOdds,
      ev: calcEV(probabilities.draw, odds.drawOdds),
      qualityScore: buildQualityScore(
        calcEV(probabilities.draw, odds.drawOdds),
        deterministicScore,
        Market.ONE_X_TWO,
        'DRAW',
        odds.drawOdds,
      ),
      isCombo: false,
    },
    {
      market: Market.ONE_X_TWO,
      pick: 'AWAY',
      probability: probabilities.away,
      odds: odds.awayOdds,
      ev: calcEV(probabilities.away, odds.awayOdds),
      qualityScore: buildQualityScore(
        calcEV(probabilities.away, odds.awayOdds),
        deterministicScore,
        Market.ONE_X_TWO,
        'AWAY',
        odds.awayOdds,
      ),
      isCombo: false,
    },
  ];

  return candidates
    .map((candidate) => {
      const rejectionReason = getPickRejectionReason(
        candidate,
        suspendedMarkets,
        probabilities,
        config,
        minEv,
        // lambdaTotal not needed — this helper only evaluates 1X2 picks, never UNDER.
        0,
      );
      return rejectionReason ? { ...candidate, rejectionReason } : candidate;
    })
    .sort((a, b) => b.qualityScore.comparedTo(a.qualityScore));
}

export function listEvaluatedPicks(
  probabilities: MatchProbabilities,
  odds: FullOddsSnapshot,
  deterministicScore: Decimal,
  distHome: number[],
  distAway: number[],
  lambdaFloorHit: boolean,
  suspendedMarkets: ReadonlySet<Market>,
  config: SelectionConfig,
  overrideMinEv?: Decimal,
): EvaluatedPick[] {
  const minEv = overrideMinEv ?? config.leagueEvThreshold;
  const lambdaTotal =
    distHome.reduce((sum, p, k) => sum + k * p, 0) +
    distAway.reduce((sum, p, k) => sum + k * p, 0);
  const candidates: ViablePick[] = [];

  // Singles 1X2
  const oneXTwoPicks = [
    {
      pick: 'HOME',
      probability: probabilities.home,
      pickOdds: odds.homeOdds,
    },
    {
      pick: 'DRAW',
      probability: probabilities.draw,
      pickOdds: odds.drawOdds,
    },
    {
      pick: 'AWAY',
      probability: probabilities.away,
      pickOdds: odds.awayOdds,
    },
  ];
  for (const c of oneXTwoPicks) {
    const ev = calcEV(c.probability, c.pickOdds);
    candidates.push({
      market: Market.ONE_X_TWO,
      pick: c.pick,
      probability: c.probability,
      odds: c.pickOdds,
      ev,
      qualityScore: buildQualityScore(
        ev,
        deterministicScore,
        Market.ONE_X_TWO,
        c.pick,
        c.pickOdds,
      ),
      isCombo: false,
    });
  }

  // Singles Over/Under
  const overUnderCandidates: Array<{
    pick: string;
    probability: Decimal;
    odds: Decimal | null | undefined;
  }> = [
    {
      pick: 'OVER_1_5',
      probability: probabilities.over15,
      odds: odds.overUnderOdds['OVER_1_5'],
    },
    {
      pick: 'UNDER_1_5',
      probability: probabilities.under15,
      odds: odds.overUnderOdds['UNDER_1_5'],
    },
    {
      pick: 'OVER',
      probability: probabilities.over25,
      odds: odds.overUnderOdds['OVER'],
    },
    {
      pick: 'UNDER',
      probability: probabilities.under25,
      odds: odds.overUnderOdds['UNDER'],
    },
    {
      pick: 'OVER_3_5',
      probability: probabilities.over35,
      odds: odds.overUnderOdds['OVER_3_5'],
    },
    {
      pick: 'UNDER_3_5',
      probability: probabilities.under35,
      odds: odds.overUnderOdds['UNDER_3_5'],
    },
    {
      pick: 'OVER_4_5',
      probability: probabilities.over45,
      odds: odds.overUnderOdds['OVER_4_5'],
    },
    {
      pick: 'UNDER_4_5',
      probability: probabilities.under45,
      odds: odds.overUnderOdds['UNDER_4_5'],
    },
  ];

  for (const candidate of overUnderCandidates) {
    if (candidate.odds === null || candidate.odds === undefined) continue;
    const ev = calcEV(candidate.probability, candidate.odds);
    candidates.push({
      market: Market.OVER_UNDER,
      pick: candidate.pick,
      probability: candidate.probability,
      odds: candidate.odds,
      ev,
      qualityScore: buildQualityScore(
        ev,
        deterministicScore,
        Market.OVER_UNDER,
        candidate.pick,
        candidate.odds,
      ),
      isCombo: false,
    });
  }

  // Singles BTTS
  if (odds.bttsYesOdds !== null) {
    const ev = calcEV(probabilities.bttsYes, odds.bttsYesOdds);
    candidates.push({
      market: Market.BTTS,
      pick: 'YES',
      probability: probabilities.bttsYes,
      odds: odds.bttsYesOdds,
      ev,
      qualityScore: buildQualityScore(
        ev,
        deterministicScore,
        Market.BTTS,
        'YES',
        odds.bttsYesOdds,
      ),
      isCombo: false,
    });
  }
  if (odds.bttsNoOdds !== null) {
    const ev = calcEV(probabilities.bttsNo, odds.bttsNoOdds);
    candidates.push({
      market: Market.BTTS,
      pick: 'NO',
      probability: probabilities.bttsNo,
      odds: odds.bttsNoOdds,
      ev,
      qualityScore: buildQualityScore(
        ev,
        deterministicScore,
        Market.BTTS,
        'NO',
        odds.bttsNoOdds,
      ),
      isCombo: false,
    });
  }

  // Singles DOUBLE_CHANCE
  if (odds.doubleChanceOdds !== null) {
    for (const [pick, dcProba] of [
      ['1X', probabilities.dc1X],
      ['X2', probabilities.dcX2],
      ['12', probabilities.dc12],
    ] as const) {
      const dcOdds = odds.doubleChanceOdds[pick];
      if (dcOdds === null) continue;
      const ev = calcEV(dcProba, dcOdds);
      candidates.push({
        market: Market.DOUBLE_CHANCE,
        pick,
        probability: dcProba,
        odds: dcOdds,
        ev,
        qualityScore: buildQualityScore(
          ev,
          deterministicScore,
          Market.DOUBLE_CHANCE,
          pick,
          dcOdds,
        ),
        isCombo: false,
      });
    }
  }

  // Singles HALF_TIME_FULL_TIME
  for (const pick of HALF_TIME_FULL_TIME_PICKS) {
    const pickOdds = odds.htftOdds[pick] ?? null;
    if (pickOdds === null) continue;

    const probability = probabilities.htft[pick];
    const ev = calcEV(probability, pickOdds);
    candidates.push({
      market: Market.HALF_TIME_FULL_TIME,
      pick,
      probability,
      odds: pickOdds,
      ev,
      qualityScore: buildQualityScore(
        ev,
        deterministicScore,
        Market.HALF_TIME_FULL_TIME,
        pick,
        pickOdds,
      ),
      isCombo: false,
    });
  }

  // Singles OVER_UNDER_HT
  const ouHtCandidates: Array<{
    pick: 'OVER_0_5' | 'UNDER_0_5' | 'OVER_1_5' | 'UNDER_1_5';
    probability: Decimal;
  }> = [
    {
      pick: 'OVER_0_5',
      probability: probabilities.ouHT['OVER_0_5'] ?? new Decimal(0),
    },
    {
      pick: 'UNDER_0_5',
      probability: probabilities.ouHT['UNDER_0_5'] ?? new Decimal(0),
    },
    {
      pick: 'OVER_1_5',
      probability: probabilities.ouHT['OVER_1_5'] ?? new Decimal(0),
    },
    {
      pick: 'UNDER_1_5',
      probability: probabilities.ouHT['UNDER_1_5'] ?? new Decimal(0),
    },
  ];
  for (const candidate of ouHtCandidates) {
    const pickOdds = odds.ouHtOdds[candidate.pick];
    if (!pickOdds) continue;
    const ev = calcEV(candidate.probability, pickOdds);
    candidates.push({
      market: Market.OVER_UNDER_HT,
      pick: candidate.pick,
      probability: candidate.probability,
      odds: pickOdds,
      ev,
      qualityScore: buildQualityScore(
        ev,
        deterministicScore,
        Market.OVER_UNDER_HT,
        candidate.pick,
        pickOdds,
      ),
      isCombo: false,
    });
  }

  // Singles FIRST_HALF_WINNER
  if (odds.firstHalfWinnerOdds !== null) {
    const fhwCandidates: Array<{
      pick: string;
      probability: Decimal;
      pickOdds: Decimal;
    }> = [
      {
        pick: 'HOME',
        probability: probabilities.firstHalfWinner.home,
        pickOdds: odds.firstHalfWinnerOdds.home,
      },
      {
        pick: 'DRAW',
        probability: probabilities.firstHalfWinner.draw,
        pickOdds: odds.firstHalfWinnerOdds.draw,
      },
      {
        pick: 'AWAY',
        probability: probabilities.firstHalfWinner.away,
        pickOdds: odds.firstHalfWinnerOdds.away,
      },
    ];
    for (const candidate of fhwCandidates) {
      const ev = calcEV(candidate.probability, candidate.pickOdds);
      candidates.push({
        market: Market.FIRST_HALF_WINNER,
        pick: candidate.pick,
        probability: candidate.probability,
        odds: candidate.pickOdds,
        ev,
        qualityScore: buildQualityScore(
          ev,
          deterministicScore,
          Market.FIRST_HALF_WINNER,
          candidate.pick,
          candidate.pickOdds,
        ),
        isCombo: false,
      });
    }
  }

  // Combos from COMBO_WHITELIST. Disabled globally during single-pick calibration
  // phase (COMBOS_ENABLED = false). Also disabled per-fixture when lambdas collapse
  // to the floor (Poisson scoreline mass becomes unreliable).
  if (COMBOS_ENABLED && !lambdaFloorHit) {
    for (const combo of COMBO_WHITELIST) {
      const p1Odds = getPickOddsFromSnapshot(combo.market1, combo.pick1, odds);
      const p2Odds = getPickOddsFromSnapshot(combo.market2, combo.pick2, odds);
      if (p1Odds === null || p2Odds === null) continue;
      if (
        p1Odds.greaterThan(MAX_SELECTION_ODDS) ||
        p2Odds.greaterThan(MAX_SELECTION_ODDS)
      )
        continue;

      const jointProbability = computeJointProbability(
        combo,
        distHome,
        distAway,
      );
      const oddsCombo = estimateComboOdds({
        combo,
        probabilities,
        jointProbability,
        odds1: p1Odds,
        odds2: p2Odds,
      });
      const ev = calcEV(jointProbability, oddsCombo);
      candidates.push({
        market: combo.market1,
        pick: combo.pick1,
        comboMarket: combo.market2,
        comboPick: combo.pick2,
        probability: jointProbability,
        odds: oddsCombo,
        ev,
        qualityScore: buildQualityScore(
          ev,
          deterministicScore,
          combo.market1,
          combo.pick1,
          oddsCombo,
        ),
        isCombo: true,
      });
    }
  }

  // Filter: EV >= league threshold and no suspended market
  const evaluated = candidates.map((candidate) => {
    const rejectionReason = getPickRejectionReason(
      candidate,
      suspendedMarkets,
      probabilities,
      config,
      minEv,
      lambdaTotal,
    );
    return rejectionReason ? { ...candidate, rejectionReason } : candidate;
  });

  return evaluated.sort((a, b) => b.qualityScore.comparedTo(a.qualityScore));
}
