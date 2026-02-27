import type { Fixture } from '@evcore/db';
import Decimal from 'decimal.js';

const RECENT_FORM_DECAY = new Decimal(0.8);
const MAX_RECENT_FORM_MATCHES = 5;
const MAX_ROLLING_XG_MATCHES = 10;

export type MatchResult = 'W' | 'D' | 'L';

export function calculateRecentForm(results: MatchResult[]): Decimal {
  const lastFive = results.slice(-MAX_RECENT_FORM_MATCHES).reverse();

  if (lastFive.length === 0) {
    return new Decimal(0);
  }

  const weightedPoints = lastFive.reduce((sum, result, i) => {
    const weight = RECENT_FORM_DECAY.pow(i);
    const points = result === 'W' ? 3 : result === 'D' ? 1 : 0;
    return sum.plus(weight.times(points));
  }, new Decimal(0));

  const maxPossible = lastFive.reduce(
    (sum, _result, i) => sum.plus(RECENT_FORM_DECAY.pow(i).times(3)),
    new Decimal(0),
  );

  return weightedPoints.div(maxPossible);
}

export function calculateRollingXg(
  fixtures: Fixture[],
  teamId: string,
): { xgFor: Decimal; xgAgainst: Decimal } {
  const withXg = fixtures.filter(
    (fixture) => fixture.homeXg !== null && fixture.awayXg !== null,
  );
  const lastTen = withXg.slice(-MAX_ROLLING_XG_MATCHES);

  if (lastTen.length === 0) {
    return { xgFor: new Decimal(0), xgAgainst: new Decimal(0) };
  }

  const totals = lastTen.reduce(
    (acc, fixture) => {
      const isHome = fixture.homeTeamId === teamId;
      const xgFor = new Decimal(
        isHome ? (fixture.homeXg ?? 0) : (fixture.awayXg ?? 0),
      );
      const xgAgainst = new Decimal(
        isHome ? (fixture.awayXg ?? 0) : (fixture.homeXg ?? 0),
      );

      return {
        for: acc.for.plus(xgFor),
        against: acc.against.plus(xgAgainst),
      };
    },
    { for: new Decimal(0), against: new Decimal(0) },
  );

  return {
    xgFor: totals.for.div(lastTen.length),
    xgAgainst: totals.against.div(lastTen.length),
  };
}

export function calculateDomExtPerf(
  fixtures: Fixture[],
  teamId: string,
): { homeWinRate: Decimal; awayWinRate: Decimal; drawRate: Decimal } {
  const withScore = fixtures.filter(
    (fixture) => fixture.homeScore !== null && fixture.awayScore !== null,
  );

  const home = withScore.filter((fixture) => fixture.homeTeamId === teamId);
  const away = withScore.filter((fixture) => fixture.awayTeamId === teamId);

  const homeWins = home.filter(
    (fixture) => (fixture.homeScore ?? 0) > (fixture.awayScore ?? 0),
  ).length;
  const awayWins = away.filter(
    (fixture) => (fixture.awayScore ?? 0) > (fixture.homeScore ?? 0),
  ).length;
  const draws = withScore.filter(
    (fixture) => (fixture.homeScore ?? 0) === (fixture.awayScore ?? 0),
  ).length;

  return {
    homeWinRate:
      home.length > 0 ? new Decimal(homeWins).div(home.length) : new Decimal(0),
    awayWinRate:
      away.length > 0 ? new Decimal(awayWins).div(away.length) : new Decimal(0),
    drawRate:
      withScore.length > 0
        ? new Decimal(draws).div(withScore.length)
        : new Decimal(0),
  };
}

export function calculateLeagueVolatility(fixtures: Fixture[]): Decimal {
  const totals = fixtures
    .filter(
      (fixture) => fixture.homeScore !== null && fixture.awayScore !== null,
    )
    .map((fixture) =>
      new Decimal(fixture.homeScore ?? 0).plus(fixture.awayScore ?? 0),
    );

  if (totals.length < 2) {
    return new Decimal(0);
  }

  const mean = totals
    .reduce((sum, total) => sum.plus(total), new Decimal(0))
    .div(totals.length);

  const variance = totals
    .reduce((sum, total) => sum.plus(total.minus(mean).pow(2)), new Decimal(0))
    .div(totals.length);

  return variance.sqrt();
}

export function resultForTeam(
  fixture: Fixture,
  teamId: string,
): MatchResult | null {
  if (fixture.homeScore === null || fixture.awayScore === null) {
    return null;
  }

  if (fixture.homeTeamId === teamId) {
    if (fixture.homeScore > fixture.awayScore) return 'W';
    if (fixture.homeScore < fixture.awayScore) return 'L';
    return 'D';
  }

  if (fixture.awayTeamId === teamId) {
    if (fixture.awayScore > fixture.homeScore) return 'W';
    if (fixture.awayScore < fixture.homeScore) return 'L';
    return 'D';
  }

  return null;
}
