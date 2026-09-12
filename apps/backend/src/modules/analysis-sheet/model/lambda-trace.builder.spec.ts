import { describe, expect, it } from 'vitest';
import { adjustLambdaForH2H } from '@modules/betting-engine/h2h.utils';
import {
  buildDataCoverageDetail,
  buildLambdaTrace,
  type LambdaConfigSnapshot,
} from './lambda-trace.builder';

const CONFIG: LambdaConfigSnapshot = {
  meanLambda: 1.35,
  homeAdvFactor: 1.1,
  awayDisadvFactor: 0.9,
  lambdaScale: 1,
  shrinkageFactor: 0.7,
};

const GAMMA = 0.2;

describe('buildLambdaTrace', () => {
  it('reconstruit le λ de base en inversant exactement la correction H2H', () => {
    const base = { home: 1.6, away: 1.1 };
    const h2hScore = 0.75;
    // On rejoue la correction réelle du moteur pour obtenir le λ publié.
    const final = adjustLambdaForH2H({
      lambda: base,
      favoriteIsHome: true,
      h2hScore,
      gamma: GAMMA,
    });

    const trace = buildLambdaTrace({
      features: {
        lambdaHome: final.home,
        lambdaAway: final.away,
        lambdaFloorHit: false,
        h2h_correction_applied: true,
        shadow_h2h: h2hScore,
        // Favori à domicile : c'est ce que le moteur a utilisé.
        rawPoissonProbability: { home: 0.52, draw: 0.24, away: 0.24 },
      },
      config: CONFIG,
      gamma: GAMMA,
    });

    expect(trace.baseDerivation).toBe('inverted_from_final');
    expect(trace.base?.home).toBeCloseTo(base.home, 3);
    expect(trace.base?.away).toBeCloseTo(base.away, 3);
    expect(trace.final).toMatchObject({ home: final.home, away: final.away });
  });

  it('reconstruit aussi quand le favori est à l’extérieur', () => {
    const base = { home: 0.9, away: 1.7 };
    const h2hScore = 0.3;
    const final = adjustLambdaForH2H({
      lambda: base,
      favoriteIsHome: false,
      h2hScore,
      gamma: GAMMA,
    });

    const trace = buildLambdaTrace({
      features: {
        lambdaHome: final.home,
        lambdaAway: final.away,
        h2h_correction_applied: true,
        shadow_h2h: h2hScore,
        rawPoissonProbability: { home: 0.22, draw: 0.25, away: 0.53 },
      },
      config: CONFIG,
      gamma: GAMMA,
    });

    expect(trace.base?.home).toBeCloseTo(base.home, 3);
    expect(trace.base?.away).toBeCloseTo(base.away, 3);
  });

  it('traite le λ final comme λ de base quand la correction H2H n’a pas joué', () => {
    const trace = buildLambdaTrace({
      features: {
        lambdaHome: 1.4,
        lambdaAway: 1.1,
        h2h_correction_applied: false,
        shadow_h2h: null,
      },
      config: CONFIG,
      gamma: GAMMA,
    });

    expect(trace.baseDerivation).toBe('final_is_base');
    expect(trace.base).toEqual({ home: 1.4, away: 1.1 });

    const h2hStep = trace.steps.find(
      (step) => step.name === 'h2h_lambda_correction',
    );
    expect(h2hStep?.applied).toBe(false);
    expect(h2hStep?.lambdaDelta).toEqual({ home: 0, away: 0 });
  });

  it('refuse de reconstruire un λ saturé par le clamp', () => {
    const trace = buildLambdaTrace({
      features: {
        lambdaHome: 0.05,
        lambdaAway: 1.2,
        h2h_correction_applied: true,
        shadow_h2h: 0.9,
        rawPoissonProbability: { home: 0.1, draw: 0.2, away: 0.7 },
      },
      config: CONFIG,
      gamma: GAMMA,
    });

    expect(trace.base).toBeNull();
    expect(trace.baseDerivation).toBe('unavailable');
    expect(trace.notes.join(' ')).toContain('saturé');
  });

  it('liste les cinq étapes et distingue celles qui agissent sur λ', () => {
    const trace = buildLambdaTrace({
      features: {
        lambdaHome: 1.5,
        lambdaAway: 1.2,
        h2h_correction_applied: true,
        shadow_h2h: 0.6,
        congestion_correction_applied: true,
        shadow_congestion: 0.1,
        rawPoissonProbability: { home: 0.45, draw: 0.28, away: 0.27 },
      },
      config: CONFIG,
      gamma: GAMMA,
    });

    expect(trace.steps).toHaveLength(5);
    expect(trace.steps.filter((s) => s.target === 'lambda')).toHaveLength(1);
    expect(
      trace.steps.filter((s) => s.target === 'probabilities'),
    ).toHaveLength(4);
    expect(trace.steps.map((s) => s.name)).toEqual([
      'h2h_lambda_correction',
      'three_way_empirical_blend',
      'over_under_shrinkage',
      'h2h_market_signal_shift',
      'congestion_signal_shift',
    ]);
  });

  it('expose les paramètres de ligue et la formule de deriveLambdas', () => {
    const trace = buildLambdaTrace({
      features: { lambdaHome: 1.4, lambdaAway: 1.1 },
      config: CONFIG,
      gamma: GAMMA,
    });

    expect(trace.inputs.meanLambda).toBe(1.35);
    expect(trace.inputs.homeAdvFactor).toBe(1.1);
    expect(trace.inputs.shrinkageFactor).toBe(0.7);
    expect(trace.formula).toContain('leagueAvg');
    // Les xG par équipe ne sont pas persistés : null, jamais estimés.
    expect(trace.inputs.homeXgFor).toBeNull();
  });

  it('motive un λ totalement absent', () => {
    const trace = buildLambdaTrace({
      features: {},
      config: CONFIG,
      gamma: GAMMA,
    });

    expect(trace.final).toBeNull();
    expect(trace.reason).toBe('predates_field');
  });
});

describe('buildDataCoverageDetail', () => {
  it('rend un niveau entier en plus du ratio, pour que le filtrage soit possible', () => {
    // Cas dominant en production : H2H + congestion, pas de line movement.
    const detail = buildDataCoverageDetail({
      shadow_h2h: 0.6,
      shadow_congestion: 0,
      shadow_lineMovement: null,
    });

    expect(detail.level).toBe(2);
    expect(detail.maxLevel).toBe(3);
    expect(detail.ratio).toBeCloseTo(0.6667, 4);
    // Le piège que `level` existe pour éviter.
    expect(detail.ratio >= 0.67).toBe(false);
  });

  it('nomme la composante absente et son motif', () => {
    const detail = buildDataCoverageDetail({
      shadow_h2h: null,
      shadow_congestion: 0.2,
      shadow_lineMovement: null,
    });

    expect(detail.level).toBe(1);
    const h2h = detail.components.find((c) => c.name === 'h2h');
    expect(h2h?.present).toBe(false);
    expect(h2h?.reason).toBe('sample_too_small');
  });

  it('atteint 3/3 quand les trois signaux existent', () => {
    const detail = buildDataCoverageDetail({
      shadow_h2h: 0.5,
      shadow_congestion: 0.1,
      shadow_lineMovement: -0.02,
    });

    expect(detail.level).toBe(3);
    expect(detail.ratio).toBe(1);
  });
});
