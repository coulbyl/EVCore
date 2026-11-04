import { describe, expect, it } from 'vitest';
import { buildLambdaConfig } from './probability';

describe('buildLambdaConfig league strength', () => {
  it('gives a European fixture between two leagues its λ factors', () => {
    const config = buildLambdaConfig('UEL', { home: 'L1', away: 'GRE1' });
    expect(config.crossLeagueFactors.home).toBeCloseTo(Math.exp(0.211), 3);
    expect(config.crossLeagueFactors.away).toBeCloseTo(Math.exp(-0.211), 3);
  });

  it('is neutral without leagues or for two teams of one league', () => {
    expect(buildLambdaConfig('L1').crossLeagueFactors).toEqual({
      home: 1,
      away: 1,
    });
    expect(buildLambdaConfig('UCL', null).crossLeagueFactors).toEqual({
      home: 1,
      away: 1,
    });
    expect(
      buildLambdaConfig('UCL', { home: 'PL', away: 'PL' }).crossLeagueFactors,
    ).toEqual({ home: 1, away: 1 });
  });
});
