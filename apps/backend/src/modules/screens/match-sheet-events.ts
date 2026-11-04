import type { MatchEventFact } from '@evcore/analysis-core';
import type { SheetRedCard, SheetScorer } from './match-sheet.types';

const GOAL_KINDS: Readonly<Record<string, SheetScorer['kind']>> = {
  'Normal Goal': 'goal',
  Penalty: 'penalty',
  'Own Goal': 'own',
};

const RED_CARDS = new Set(['Red Card', 'Second Yellow card']);

// A shoot-out kick is listed as a goal; it is not one of the score's.
const SHOOTOUT = 'Penalty Shootout';

// The sheet's score is the full-time one (fixture.homeScore, 90 minutes
// and their stoppage time): extra-time goals (91' to 120') are not in it.
const LAST_REGULATION_MINUTE = 90;

/**
 * The scorers and red cards of a finished match (plan 03/11, phase 2),
 * from its API-Football events. A goal without a scorer is left out: the
 * API keeps a goal cancelled by the VAR that way (3 of 399 matches,
 * 03/11), and so is a shoot-out kick. An own goal's event names the team
 * it counts for. When the goals
 * left do not make the score, nothing is shown rather than a wrong list.
 */
export function sheetEventsOf(input: {
  /** The match facts' events, their team resolved to a side. */
  events: readonly MatchEventFact[];
  score: { home: number; away: number } | null;
}): { scorers: SheetScorer[]; redCards: SheetRedCard[] } | null {
  const { events, score } = input;
  if (events.length === 0 || score === null) return null;
  const ordered = [...events].sort(
    (a, b) =>
      a.minute - b.minute ||
      (a.extraMinute ?? 0) - (b.extraMinute ?? 0) ||
      a.ordinal - b.ordinal,
  );

  const scorers: SheetScorer[] = [];
  const redCards: SheetRedCard[] = [];
  for (const event of ordered) {
    const team = event.side;
    if (team === null || event.playerName === null) continue;
    const at = { minute: event.minute, extraMinute: event.extraMinute };
    if (event.type === 'GOAL') {
      if (event.comments === SHOOTOUT) continue;
      if (event.minute > LAST_REGULATION_MINUTE) continue;
      const kind = GOAL_KINDS[event.detail];
      if (kind) scorers.push({ ...at, player: event.playerName, team, kind });
    } else if (
      event.type === 'CARD' &&
      RED_CARDS.has(event.detail) &&
      !cancelled(event, events)
    ) {
      redCards.push({ ...at, player: event.playerName, team });
    }
  }

  const goals = (side: 'home' | 'away') =>
    scorers.filter((scorer) => scorer.team === side).length;
  if (goals('home') !== score.home || goals('away') !== score.away) {
    return null;
  }
  return { scorers, redCards };
}

/** A red card the VAR took back: same team, same player. */
function cancelled(
  card: MatchEventFact,
  events: readonly MatchEventFact[],
): boolean {
  return events.some(
    (event) =>
      event.type === 'VAR' &&
      event.detail === 'Red card cancelled' &&
      event.side === card.side &&
      event.playerName === card.playerName,
  );
}
