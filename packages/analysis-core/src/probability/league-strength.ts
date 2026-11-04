// League strength for fixtures between teams of different national leagues
// (UCL / UEL / UECL). In those fixtures the engine blends each team's
// domestic team_stats line (60 % of the xG) without any notion of how strong
// that domestic league is: 0.70 conceded against Greek attacks counts as
// 0.70 against Ligue 1 attacks (docs/audits/2026-11-04/
// ESTIMATION-LOIN-DU-MARCHE.md). This module estimates one log-strength per
// national league from inter-league fixtures already played, and turns two
// strengths into a pair of λ multipliers. Pure: the caller chooses the
// observations, so point-in-time is the caller's job (only fixtures played
// before the analysed one).
//
// Model, fixed before any validation run (docs/audits/2026-11-04/
// FORCE-CHAMPIONNATS.md):
//   homeGoals ~ Poisson(λ0_home · exp(r_H − r_A))
//   awayGoals ~ Poisson(λ0_away · exp(r_A − r_H))
// λ0 is the engine's own baseline λ for that fixture (no strength term), so
// r_L reads as "how much the engine under-rates teams of league L against
// teams of other leagues". Ridge penalty r² / (2 σ²) shrinks every league
// toward 0 (factor 1); a league seen in fewer than `minMatches` inter-league
// fixtures, or never, stays at exactly 0.

export type LeagueStrengthObservation = {
  homeLeague: string | null;
  awayLeague: string | null;
  lambdaHome: number;
  lambdaAway: number;
  homeGoals: number;
  awayGoals: number;
};

export type LeagueStrengthFitOptions = {
  priorSd: number;
  minMatches: number;
  iterations?: number;
};

// Log-strength per league code; a missing code means 0 (factor 1).
export type LeagueStrengths = Readonly<Record<string, number>>;

// Prior standard deviation of a league log-strength: a league one σ above
// the average scores/concedes exp(0.2) ≈ 1.22× more/less than the engine
// expects against an average opponent. Fixed a priori, not tuned.
export const LEAGUE_STRENGTH_PRIOR_SD = 0.2;
// Below this many inter-league fixtures a league keeps strength 0.
export const LEAGUE_STRENGTH_MIN_MATCHES = 10;
// Hard bound on one λ multiplier, whatever the fit says.
export const LEAGUE_STRENGTH_MAX_FACTOR = 1.5;

const DEFAULT_ITERATIONS = 50;

function isInterLeague(observation: LeagueStrengthObservation): boolean {
  return (
    observation.homeLeague !== observation.awayLeague &&
    (observation.homeLeague !== null || observation.awayLeague !== null)
  );
}

/**
 * Ridge-penalised Poisson fit of one log-strength per league (coordinate
 * Newton). Same-league fixtures carry no information (r cancels) and are
 * ignored; an unknown league is held at 0.
 */
export function fitLeagueStrengths(
  observations: readonly LeagueStrengthObservation[],
  options: LeagueStrengthFitOptions,
): Record<string, number> {
  const usable = observations.filter(isInterLeague);
  const counts = new Map<string, number>();
  for (const o of usable) {
    for (const league of [o.homeLeague, o.awayLeague]) {
      if (league !== null) counts.set(league, (counts.get(league) ?? 0) + 1);
    }
  }
  const fitted = [...counts.entries()]
    .filter(([, n]) => n >= options.minMatches)
    .map(([league]) => league)
    .sort();
  const strength = new Map<string, number>(fitted.map((l) => [l, 0]));
  const of = (league: string | null): number =>
    league === null ? 0 : (strength.get(league) ?? 0);
  const precision = 1 / (options.priorSd * options.priorSd);

  for (let i = 0; i < (options.iterations ?? DEFAULT_ITERATIONS); i++) {
    for (const league of fitted) {
      let gradient = -precision * of(league);
      let curvature = precision;
      for (const o of usable) {
        const sign =
          o.homeLeague === league ? 1 : o.awayLeague === league ? -1 : 0;
        if (sign === 0) continue;
        const diff = of(o.homeLeague) - of(o.awayLeague);
        const muHome = o.lambdaHome * Math.exp(diff);
        const muAway = o.lambdaAway * Math.exp(-diff);
        gradient += sign * (o.homeGoals - muHome - (o.awayGoals - muAway));
        curvature += muHome + muAway;
      }
      strength.set(league, of(league) + gradient / curvature);
    }
  }
  return Object.fromEntries(strength);
}

/**
 * λ multipliers for one fixture: exp(r_H − r_A) on the home λ and its
 * inverse on the away λ, each bounded by LEAGUE_STRENGTH_MAX_FACTOR. Two
 * teams of the same league, or two leagues without strength, give 1 / 1.
 */
export function crossLeagueLambdaFactors(input: {
  homeLeague: string | null;
  awayLeague: string | null;
  strengths: LeagueStrengths;
}): { home: number; away: number } {
  const { homeLeague, awayLeague, strengths } = input;
  if (homeLeague === awayLeague) return { home: 1, away: 1 };
  const of = (league: string | null): number =>
    league === null ? 0 : (strengths[league] ?? 0);
  const bound = Math.log(LEAGUE_STRENGTH_MAX_FACTOR);
  const diff = Math.min(
    bound,
    Math.max(-bound, of(homeLeague) - of(awayLeague)),
  );
  return { home: Math.exp(diff), away: Math.exp(-diff) };
}
