import { isEuropeanCompetition } from '@modules/betting-engine/ev.constants';

// Leagues whose season starts in the second half of the year (Jul-Dec) run
// into the following calendar year (e.g. "2023-24"). Leagues starting in the
// first half (Jan-Jun) complete within a single calendar year (e.g. "2023").
//
// UEFA cup competitions (UCL/UEL/UECL) always span two calendar years by
// convention, even though their qualifying rounds kick off in June — before
// the >=6 threshold below. Without the override, lowering a competition's
// `seasonStartMonth` to capture those early qualifying rounds (see
// fixtures-sync.worker's date window) silently flips the computed name from
// "2026-27" to "2026" mid-competition, and since `upsertSeason` keys on
// (competitionId, name), that splits one real season across two `season`
// rows with disjoint fixtures — audit 2026-08-01 found exactly this for UCL:
// early qualifying legs on one row, their return legs on the other, making
// two-legged-tie pairing (MatchLegDetectionService) silently fail.
export function seasonNameFromYear(
  year: number,
  seasonStartMonth: number,
  competitionCode: string | null = null,
): string {
  return seasonStartMonth >= 6 || isEuropeanCompetition(competitionCode)
    ? `${year}-${String(year + 1).slice(-2)}`
    : `${year}`;
}
