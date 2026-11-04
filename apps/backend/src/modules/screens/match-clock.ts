/**
 * Where a match's clock stands, as the coupons of « Aujourd'hui » and the
 * match sheet show it: « 67' », « MT », « Terminé ». The minute is the
 * API's at the last settlement pass (every 30 minutes), never extrapolated.
 */
export type MatchClock =
  | { kind: 'live'; minute: number | null }
  | { kind: 'half_time' }
  | { kind: 'finished' };

// API-Football's breaks: half-time, and before extra time.
const BREAKS = new Set(['HT', 'BT']);

/**
 * The clock of a match: none before kick-off nor for a postponed or
 * cancelled one. Kicked off but not yet seen in progress: live without a
 * minute (« En cours »).
 */
export function matchClockOf(
  row: {
    status: string;
    scheduledAt: Date;
    liveStatus: string | null;
    liveElapsed: number | null;
  },
  now: Date,
): MatchClock | null {
  if (row.status === 'FINISHED') return { kind: 'finished' };
  if (row.status === 'POSTPONED' || row.status === 'CANCELLED') return null;
  if (row.status === 'IN_PROGRESS') {
    if (row.liveStatus !== null && BREAKS.has(row.liveStatus)) {
      return { kind: 'half_time' };
    }
    return { kind: 'live', minute: row.liveElapsed };
  }
  return row.scheduledAt.getTime() <= now.getTime()
    ? { kind: 'live', minute: null }
    : null;
}

/** The score shown: the stored one once the match is live or finished. */
export function shownScoreOf(row: {
  status: string;
  homeScore: number | null;
  awayScore: number | null;
}): { home: number; away: number } | null {
  if (row.status !== 'FINISHED' && row.status !== 'IN_PROGRESS') return null;
  return row.homeScore === null || row.awayScore === null
    ? null
    : { home: row.homeScore, away: row.awayScore };
}
