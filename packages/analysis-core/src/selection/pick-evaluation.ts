import Decimal from "decimal.js";
import { Market } from "../types";
import type {
  ResultBttsProba,
  ResultTotalGoalsProba,
  TeamTotalProba,
} from "../probability";
import { HALF_TIME_FULL_TIME_PICKS } from "../probability";
import { calculateEV as calcEV } from "../ev/ev-math";
import { buildBetPickKey } from "./combo-pricing";
import {
  EV_HARD_CAP,
  FALLBACK_MIN_QUALITY_SCORE,
  SAFE_VALUE_MAX_ODDS,
  SAFE_VALUE_MIN_EV,
  SV_UNDER_LAMBDA_COMPARISON_THRESHOLD,
  VALUE_MIN_EDGE,
} from "./constants";
import { buildQualityScore, getPickRejectionReason } from "./pick-validation";
import type { SelectionConfig } from "./config";
import type {
  EvaluatedPick,
  FullOddsSnapshot,
  MatchProbabilities,
  TeamTotalOddsMap,
  ViablePick,
} from "./types";

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
    if (!safeValueMarkets.has(pick.market)) return false;
    if (pick.probability.lessThan(svMinProbability)) return false;
    if (pick.ev.lessThan(SAFE_VALUE_MIN_EV)) return false;
    if (pick.ev.greaterThan(EV_HARD_CAP)) return false;
    if (pick.odds.lessThan(svMinOdds)) return false;
    if (pick.odds.greaterThan(SAFE_VALUE_MAX_ODDS)) return false;
    if (suspendedMarkets.has(pick.market)) return false;
    const pickKey = buildBetPickKey({ market: pick.market, pick: pick.pick });
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
    (bestPick.pick === "UNDER_3_5" || bestPick.pick === "UNDER_4_5") &&
    lambdaTotal >= SV_UNDER_LAMBDA_COMPARISON_THRESHOLD
  ) {
    const overCounterparts = evaluatedPicks.filter(
      (p): p is ViablePick =>
        p.rejectionReason === undefined &&
        p.market === Market.OVER_UNDER &&
        (p.pick === "OVER" || p.pick === "OVER_3_5") &&
        p.ev.greaterThanOrEqualTo(SAFE_VALUE_MIN_EV) &&
        p.ev.lessThanOrEqualTo(EV_HARD_CAP) &&
        // Per-league floor (svMinOdds), like the main eligibility check —
        // the global SAFE_VALUE_MIN_ODDS here let Over counterparts slip
        // below a league override (e.g. SP2 1.45).
        p.odds.greaterThanOrEqualTo(svMinOdds) &&
        p.odds.lessThanOrEqualTo(SAFE_VALUE_MAX_ODDS) &&
        !suspendedMarkets.has(p.market) &&
        (excludedPickKey === null ||
          buildBetPickKey({ market: p.market, pick: p.pick }) !==
            excludedPickKey),
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

  // VALUE-only edge floor: the model is systematically overconfident, so require a
  // real market edge (probability − 1/odds), not just positive EV. A league config
  // may set this unreachably high to suspend VALUE entirely (see VALUE_MIN_EDGE).
  // SAFE runs through selectSafeValuePick and is intentionally not gated here.
  const minEdge = config.valueMinEdge ?? VALUE_MIN_EDGE;

  const viable = evaluated
    .filter((p): p is ViablePick => p.rejectionReason === undefined)
    .filter((p) =>
      p.probability
        .minus(new Decimal(1).div(p.odds))
        .greaterThanOrEqualTo(minEdge),
    )
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
      pick: "HOME",
      probability: probabilities.home,
      odds: odds.homeOdds,
      ev: calcEV(probabilities.home, odds.homeOdds),
      qualityScore: buildQualityScore(
        calcEV(probabilities.home, odds.homeOdds),
        deterministicScore,
        Market.ONE_X_TWO,
        "HOME",
        odds.homeOdds,
      ),
    },
    {
      market: Market.ONE_X_TWO,
      pick: "DRAW",
      probability: probabilities.draw,
      odds: odds.drawOdds,
      ev: calcEV(probabilities.draw, odds.drawOdds),
      qualityScore: buildQualityScore(
        calcEV(probabilities.draw, odds.drawOdds),
        deterministicScore,
        Market.ONE_X_TWO,
        "DRAW",
        odds.drawOdds,
      ),
    },
    {
      market: Market.ONE_X_TWO,
      pick: "AWAY",
      probability: probabilities.away,
      odds: odds.awayOdds,
      ev: calcEV(probabilities.away, odds.awayOdds),
      qualityScore: buildQualityScore(
        calcEV(probabilities.away, odds.awayOdds),
        deterministicScore,
        Market.ONE_X_TWO,
        "AWAY",
        odds.awayOdds,
      ),
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
      pick: "HOME",
      probability: probabilities.home,
      pickOdds: odds.homeOdds,
    },
    {
      pick: "DRAW",
      probability: probabilities.draw,
      pickOdds: odds.drawOdds,
    },
    {
      pick: "AWAY",
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
    });
  }

  // Singles Over/Under
  const overUnderCandidates: Array<{
    pick: string;
    probability: Decimal;
    odds: Decimal | null | undefined;
  }> = [
    {
      pick: "OVER_1_5",
      probability: probabilities.over15,
      odds: odds.overUnderOdds["OVER_1_5"],
    },
    {
      pick: "UNDER_1_5",
      probability: probabilities.under15,
      odds: odds.overUnderOdds["UNDER_1_5"],
    },
    {
      pick: "OVER",
      probability: probabilities.over25,
      odds: odds.overUnderOdds["OVER"],
    },
    {
      pick: "UNDER",
      probability: probabilities.under25,
      odds: odds.overUnderOdds["UNDER"],
    },
    {
      pick: "OVER_3_5",
      probability: probabilities.over35,
      odds: odds.overUnderOdds["OVER_3_5"],
    },
    {
      pick: "UNDER_3_5",
      probability: probabilities.under35,
      odds: odds.overUnderOdds["UNDER_3_5"],
    },
    {
      pick: "OVER_4_5",
      probability: probabilities.over45,
      odds: odds.overUnderOdds["OVER_4_5"],
    },
    {
      pick: "UNDER_4_5",
      probability: probabilities.under45,
      odds: odds.overUnderOdds["UNDER_4_5"],
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
    });
  }

  // Singles BTTS
  if (odds.bttsYesOdds !== null) {
    const ev = calcEV(probabilities.bttsYes, odds.bttsYesOdds);
    candidates.push({
      market: Market.BTTS,
      pick: "YES",
      probability: probabilities.bttsYes,
      odds: odds.bttsYesOdds,
      ev,
      qualityScore: buildQualityScore(
        ev,
        deterministicScore,
        Market.BTTS,
        "YES",
        odds.bttsYesOdds,
      ),
    });
  }
  if (odds.bttsNoOdds !== null) {
    const ev = calcEV(probabilities.bttsNo, odds.bttsNoOdds);
    candidates.push({
      market: Market.BTTS,
      pick: "NO",
      probability: probabilities.bttsNo,
      odds: odds.bttsNoOdds,
      ev,
      qualityScore: buildQualityScore(
        ev,
        deterministicScore,
        Market.BTTS,
        "NO",
        odds.bttsNoOdds,
      ),
    });
  }

  // Singles DOUBLE_CHANCE
  if (odds.doubleChanceOdds !== null) {
    for (const [pick, dcProba] of [
      ["1X", probabilities.dc1X],
      ["X2", probabilities.dcX2],
      ["12", probabilities.dc12],
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
    });
  }

  // Singles OVER_UNDER_HT
  const ouHtCandidates: Array<{
    pick: "OVER_0_5" | "UNDER_0_5" | "OVER_1_5" | "UNDER_1_5";
    probability: Decimal;
  }> = [
    {
      pick: "OVER_0_5",
      probability: probabilities.ouHT["OVER_0_5"] ?? new Decimal(0),
    },
    {
      pick: "UNDER_0_5",
      probability: probabilities.ouHT["UNDER_0_5"] ?? new Decimal(0),
    },
    {
      pick: "OVER_1_5",
      probability: probabilities.ouHT["OVER_1_5"] ?? new Decimal(0),
    },
    {
      pick: "UNDER_1_5",
      probability: probabilities.ouHT["UNDER_1_5"] ?? new Decimal(0),
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
        pick: "HOME",
        probability: probabilities.firstHalfWinner.home,
        pickOdds: odds.firstHalfWinnerOdds.home,
      },
      {
        pick: "DRAW",
        probability: probabilities.firstHalfWinner.draw,
        pickOdds: odds.firstHalfWinnerOdds.draw,
      },
      {
        pick: "AWAY",
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
      });
    }
  }

  // Singles DRAW_NO_BET
  if (odds.drawNoBetOdds !== null) {
    const dnbCandidates: Array<{
      pick: "HOME" | "AWAY";
      probability: Decimal;
      pickOdds: Decimal;
    }> = [
      {
        pick: "HOME",
        probability: probabilities.dnbHome,
        pickOdds: odds.drawNoBetOdds.home,
      },
      {
        pick: "AWAY",
        probability: probabilities.dnbAway,
        pickOdds: odds.drawNoBetOdds.away,
      },
    ];
    for (const candidate of dnbCandidates) {
      const ev = calcEV(candidate.probability, candidate.pickOdds);
      candidates.push({
        market: Market.DRAW_NO_BET,
        pick: candidate.pick,
        probability: candidate.probability,
        odds: candidate.pickOdds,
        ev,
        qualityScore: buildQualityScore(
          ev,
          deterministicScore,
          Market.DRAW_NO_BET,
          candidate.pick,
          candidate.pickOdds,
        ),
      });
    }
  }

  // Singles TEAM_TOTAL_HOME / TEAM_TOTAL_AWAY
  const teamTotalGroups: Array<{
    market: Market;
    probaMap: TeamTotalProba;
    oddsMap: TeamTotalOddsMap;
  }> = [
    {
      market: Market.TEAM_TOTAL_HOME,
      probaMap: probabilities.teamTotalHome,
      oddsMap: odds.teamTotalHomeOdds,
    },
    {
      market: Market.TEAM_TOTAL_AWAY,
      probaMap: probabilities.teamTotalAway,
      oddsMap: odds.teamTotalAwayOdds,
    },
  ];
  for (const group of teamTotalGroups) {
    for (const [pick, pickOdds] of Object.entries(group.oddsMap)) {
      if (pickOdds === undefined) continue;
      const probability = group.probaMap[pick as keyof TeamTotalProba];
      if (probability === undefined) continue;
      const ev = calcEV(probability, pickOdds);
      candidates.push({
        market: group.market,
        pick,
        probability,
        odds: pickOdds,
        ev,
        qualityScore: buildQualityScore(
          ev,
          deterministicScore,
          group.market,
          pick,
          pickOdds,
        ),
      });
    }
  }

  // Singles CLEAN_SHEET_HOME / CLEAN_SHEET_AWAY / WIN_TO_NIL_HOME / WIN_TO_NIL_AWAY
  // — YES/NO both priced against a real bookmaker two-way market.
  const yesNoGroups: Array<{
    market: Market;
    probability: Decimal;
    oddsPair: { yes: Decimal; no: Decimal } | null;
  }> = [
    {
      market: Market.CLEAN_SHEET_HOME,
      probability: probabilities.cleanSheetHome,
      oddsPair: odds.cleanSheetHomeOdds,
    },
    {
      market: Market.CLEAN_SHEET_AWAY,
      probability: probabilities.cleanSheetAway,
      oddsPair: odds.cleanSheetAwayOdds,
    },
    {
      market: Market.WIN_TO_NIL_HOME,
      probability: probabilities.winToNilHome,
      oddsPair: odds.winToNilHomeOdds,
    },
    {
      market: Market.WIN_TO_NIL_AWAY,
      probability: probabilities.winToNilAway,
      oddsPair: odds.winToNilAwayOdds,
    },
  ];
  for (const group of yesNoGroups) {
    if (group.oddsPair === null) continue;
    const yesEv = calcEV(group.probability, group.oddsPair.yes);
    candidates.push({
      market: group.market,
      pick: "YES",
      probability: group.probability,
      odds: group.oddsPair.yes,
      ev: yesEv,
      qualityScore: buildQualityScore(
        yesEv,
        deterministicScore,
        group.market,
        "YES",
        group.oddsPair.yes,
      ),
    });
    const noProbability = new Decimal(1).minus(group.probability);
    const noEv = calcEV(noProbability, group.oddsPair.no);
    candidates.push({
      market: group.market,
      pick: "NO",
      probability: noProbability,
      odds: group.oddsPair.no,
      ev: noEv,
      qualityScore: buildQualityScore(
        noEv,
        deterministicScore,
        group.market,
        "NO",
        group.oddsPair.no,
      ),
    });
  }

  // Singles TO_WIN_EITHER_HALF
  if (odds.winEitherHalfOdds !== null) {
    const wehCandidates: Array<{
      pick: "HOME" | "AWAY";
      probability: Decimal;
      pickOdds: Decimal;
    }> = [
      {
        pick: "HOME",
        probability: probabilities.winEitherHalfHome,
        pickOdds: odds.winEitherHalfOdds.home,
      },
      {
        pick: "AWAY",
        probability: probabilities.winEitherHalfAway,
        pickOdds: odds.winEitherHalfOdds.away,
      },
    ];
    for (const candidate of wehCandidates) {
      const ev = calcEV(candidate.probability, candidate.pickOdds);
      candidates.push({
        market: Market.TO_WIN_EITHER_HALF,
        pick: candidate.pick,
        probability: candidate.probability,
        odds: candidate.pickOdds,
        ev,
        qualityScore: buildQualityScore(
          ev,
          deterministicScore,
          Market.TO_WIN_EITHER_HALF,
          candidate.pick,
          candidate.pickOdds,
        ),
      });
    }
  }

  // Singles RESULT_TOTAL_GOALS — pre-combined pick (e.g. "HOME_OVER_2_5"),
  // real bookmaker price, not a synthetic combo.
  for (const [pick, pickOdds] of Object.entries(odds.resultTotalGoalsOdds)) {
    if (pickOdds === undefined) continue;
    const probability =
      probabilities.resultTotalGoals[pick as keyof ResultTotalGoalsProba];
    if (probability === undefined) continue;
    const ev = calcEV(probability, pickOdds);
    candidates.push({
      market: Market.RESULT_TOTAL_GOALS,
      pick,
      probability,
      odds: pickOdds,
      ev,
      qualityScore: buildQualityScore(
        ev,
        deterministicScore,
        Market.RESULT_TOTAL_GOALS,
        pick,
        pickOdds,
      ),
    });
  }

  // Singles RESULT_BTTS — pre-combined pick (e.g. "HOME_YES").
  for (const [pick, pickOdds] of Object.entries(odds.resultBttsOdds)) {
    if (pickOdds === undefined) continue;
    const probability = probabilities.resultBtts[pick as keyof ResultBttsProba];
    if (probability === undefined) continue;
    const ev = calcEV(probability, pickOdds);
    candidates.push({
      market: Market.RESULT_BTTS,
      pick,
      probability,
      odds: pickOdds,
      ev,
      qualityScore: buildQualityScore(
        ev,
        deterministicScore,
        Market.RESULT_BTTS,
        pick,
        pickOdds,
      ),
    });
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
