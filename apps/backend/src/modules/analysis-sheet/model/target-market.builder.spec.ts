import { describe, expect, it } from 'vitest';
import {
  buildTargetMarketEvaluations,
  isSegmentDisabled,
  type EvaluatedPickInput,
  type PickGates,
} from './target-market.builder';
import { buildMarketQuotes } from '../market/market-block.builder';

const KICKOFF = new Date('2026-09-12T18:00:00.000Z');

const OPEN_GATES: PickGates = {
  evFloor: 0.08,
  minOdds: 2,
  maxOdds: null,
  minProbability: 0.4,
};

function build(input: {
  evaluatedPicks?: EvaluatedPickInput[];
  gates?: PickGates;
  rawProbability?: (market: string, pick: string) => number | null;
}) {
  return buildTargetMarketEvaluations({
    evaluatedPicks: input.evaluatedPicks ?? [],
    quotes: buildMarketQuotes({ quotes: [], kickoff: KICKOFF }),
    rawProbabilityFor: input.rawProbability ?? (() => null),
    gatesFor: () => input.gates ?? OPEN_GATES,
  });
}

describe('buildTargetMarketEvaluations', () => {
  it('rend toujours les 7 marchés cibles, même sans aucune évaluation', () => {
    const evaluations = build({});

    expect(evaluations).toHaveLength(7);
    expect(evaluations.every((e) => e.status === 'not_evaluated')).toBe(true);
  });

  it('conserve un pick rejeté avec son motif — le rejet est du diagnostic', () => {
    // Le cas réel de l'audit : Over 1.5 à forte probabilité, coupé par l'EV.
    const evaluations = build({
      evaluatedPicks: [
        {
          market: 'OVER_UNDER',
          pick: 'OVER_1_5',
          probability: 0.715,
          odds: 1.38,
          ev: -0.0132,
          status: 'rejected',
          rejectionReason: 'ev_below_threshold',
        },
      ],
    });

    const over15 = evaluations.find((e) => e.key === 'OVER_1_5');
    expect(over15?.status).toBe('rejected');
    expect(over15?.rejectionReason).toBe('ev_below_threshold');
    // La valeur reste lisible : c'est tout l'intérêt.
    expect(over15?.modelProbability).toBe(0.715);
    expect(over15?.odds).toBe(1.38);
    expect(over15?.gates.evFloor).toBe(0.08);
  });

  it('calcule adjustmentDelta contre la probabilité Poisson brute', () => {
    const evaluations = build({
      evaluatedPicks: [
        {
          market: 'ONE_X_TWO',
          pick: 'HOME',
          probability: 0.55,
          odds: 2,
          ev: 0.1,
          status: 'viable',
          rejectionReason: null,
        },
      ],
      rawProbability: () => 0.5,
    });

    const home = evaluations.find((e) => e.key === 'HOME');
    expect(home?.rawModelProbability).toBe(0.5);
    expect(home?.adjustmentDelta).toBeCloseTo(0.05, 4);
  });

  it('laisse adjustmentDelta null quand le Poisson brut ne couvre pas le marché', () => {
    const evaluations = build({
      evaluatedPicks: [
        {
          market: 'TO_WIN_EITHER_HALF',
          pick: 'HOME',
          probability: 0.45,
          odds: 2.1,
          ev: -0.05,
          status: 'rejected',
          rejectionReason: 'ev_below_threshold',
        },
      ],
    });

    const weh = evaluations.find((e) => e.key === 'WIN_EITHER_HALF_HOME');
    expect(weh?.rawModelProbability).toBeNull();
    expect(weh?.adjustmentDelta).toBeNull();
  });

  it('motive un marché jamais évalué faute de prix', () => {
    const evaluations = build({});

    expect(evaluations[0]?.reason).toBe('no_odds');
    expect(evaluations[0]?.modelProbability).toBeNull();
  });
});

describe('isSegmentDisabled', () => {
  it('reconnaît un plancher d’EV sentinelle comme une désactivation', () => {
    // EV_HARD_CAP = 0.90 rejette tout pick au-dessus : 0.99 et 2.99 sont
    // mathématiquement infranchissables, pas des seuils exigeants.
    expect(isSegmentDisabled({ ...OPEN_GATES, evFloor: 0.99 })).toBe(true);
    expect(isSegmentDisabled({ ...OPEN_GATES, evFloor: 2.99 })).toBe(true);
  });

  it('ne confond pas un plancher exigeant avec une désactivation', () => {
    expect(isSegmentDisabled({ ...OPEN_GATES, evFloor: 0.08 })).toBe(false);
    expect(isSegmentDisabled({ ...OPEN_GATES, evFloor: 0.9 })).toBe(false);
    expect(isSegmentDisabled({ ...OPEN_GATES, evFloor: null })).toBe(false);
  });

  it('remonte le drapeau dans les évaluations exposées', () => {
    const evaluations = build({ gates: { ...OPEN_GATES, evFloor: 2.99 } });

    expect(evaluations.every((e) => e.gates.segmentDisabled)).toBe(true);
  });
});
