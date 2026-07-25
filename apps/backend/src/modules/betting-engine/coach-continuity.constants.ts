// "New coach" window shown on Décisions/Investir match cards — informational
// only, never fed into scoring/EV (see rolling-stats.service.ts for the
// actual scoring-side correction, which fixes recentForm's lag instead of
// adding a new factor).
//
// Backtested 2026-07-25 (db:coach-bounce-backtest): teams outperform their
// own pre-change form by +0.08 pt/match on average across a team's first 5
// matches under a new coach, positive in every home/away × opponent-strength
// stratum tested. 5 matches is that same window, kept in sync with it.
export const NEW_COACH_WINDOW_MATCHES = 5;
