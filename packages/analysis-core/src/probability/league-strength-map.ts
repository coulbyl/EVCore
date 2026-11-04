import type { LeagueStrengths } from "./league-strength";

// Log-strength of each national league in European fixtures, fitted by
// fitLeagueStrengths (σ 0.2, ≥ 10 inter-league fixtures) on the 3 136
// UCL/UEL/UECL fixtures replayed from 2023-07 to 2026-10-22 with the
// production chain — output of `pnpm --filter @evcore/backtest-core
// backtest:league-strength`, pasted as is, never edited by hand. Validated
// walk-forward (strengths of earlier seasons only): 1X2 Brier −0.030
// [−0.039 ; −0.021] on 1 564 out-of-sample fixtures, better on 3 of 3
// seasons (docs/audits/2026-11-04/FORCE-CHAMPIONNATS.md).
//
// Read relative to 0 = a team without any league line in the base (clubs
// from leagues we do not ingest). A league missing here keeps 0. Refit at
// each European season start (July), with the same script.
const LEAGUE_STRENGTH_MAP: LeagueStrengths = {
  PL: 0.58,
  LL: 0.465,
  BL1: 0.425,
  SA: 0.407,
  L1: 0.394,
  DEN1: 0.301,
  POR: 0.283,
  BEL1: 0.246,
  NOR1: 0.194,
  POL1: 0.189,
  ERD: 0.183,
  GRE1: 0.183,
  TUR1: 0.145,
  CZE1: 0.133,
  SUI1: 0.1,
  SWE1: 0.089,
  AUT1: 0.072,
  SCO1: 0.059,
  FIN1: -0.103,
  SVN1: -0.121,
  ISL1: -0.131,
  SRB1: -0.136,
  IRL1: -0.148,
  LAT1: -0.2,
  EST1: -0.361,
};

export function getLeagueStrengths(): LeagueStrengths {
  return LEAGUE_STRENGTH_MAP;
}
