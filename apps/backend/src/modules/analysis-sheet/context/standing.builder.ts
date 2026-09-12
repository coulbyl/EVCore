// Classement dérivé des matchs terminés — calcul pur.
//
// La table `standing` d'API-Football n'est plus alimentée depuis 2026-07-19
// (48 lignes, une seule ligue — audit 2026-09-12 §2.4). On reconstruit donc le
// classement à partir des résultats, ce qui a trois avantages sur un worker de
// synchronisation : aucun quota API consommé, couverture de toutes les ligues
// où l'on a des matchs, et surtout un classement ARRÊTÉ À LA DATE DU MATCH —
// que l'endpoint /standings ne sait pas rendre rétroactivement.
//
// Limite assumée et signalée dans `source` : les retraits de points
// administratifs (sanctions, faillites) ne sont pas reflétés.

import { ABSENCE_REASONS, type Absent } from '../analysis-sheet-v2.types';
import type { TeamStanding } from '../analysis-sheet-v2.types';

/** Un match terminé d'une saison, non orienté. */
export type StandingFixture = {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
};

type Row = {
  teamId: string;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
};

function emptyRow(teamId: string): Row {
  return {
    teamId,
    points: 0,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  };
}

function applyResult(row: Row, goalsFor: number, goalsAgainst: number): void {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  if (goalsFor > goalsAgainst) {
    row.wins += 1;
    row.points += 3;
  } else if (goalsFor === goalsAgainst) {
    row.draws += 1;
    row.points += 1;
  } else {
    row.losses += 1;
  }
}

/**
 * Table complète de la saison à partir des matchs fournis.
 *
 * Départage : points, puis différence de buts, puis buts marqués, puis id
 * d'équipe. Le dernier critère n'a aucun sens sportif — il n'est là que pour
 * rendre le classement déterministe (deux équipes strictement à égalité ne
 * doivent pas changer de rang d'un export à l'autre).
 */
export function buildStandingTable(
  fixtures: readonly StandingFixture[],
): Map<string, TeamStanding> {
  const rows = new Map<string, Row>();

  const rowFor = (teamId: string): Row => {
    const existing = rows.get(teamId);
    if (existing) return existing;
    const created = emptyRow(teamId);
    rows.set(teamId, created);
    return created;
  };

  for (const fixture of fixtures) {
    applyResult(
      rowFor(fixture.homeTeamId),
      fixture.homeScore,
      fixture.awayScore,
    );
    applyResult(
      rowFor(fixture.awayTeamId),
      fixture.awayScore,
      fixture.homeScore,
    );
  }

  const ordered = [...rows.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const diffA = a.goalsFor - a.goalsAgainst;
    const diffB = b.goalsFor - b.goalsAgainst;
    if (diffB !== diffA) return diffB - diffA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.teamId.localeCompare(b.teamId);
  });

  const table = new Map<string, TeamStanding>();
  ordered.forEach((row, index) => {
    table.set(row.teamId, {
      source: 'derived_from_fixtures',
      rank: index + 1,
      teamCount: ordered.length,
      points: row.points,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalsDiff: row.goalsFor - row.goalsAgainst,
    });
  });

  return table;
}

/** Ligne de classement d'une équipe, ou l'absence motivée. */
export function standingFor(
  table: Map<string, TeamStanding>,
  teamId: string,
): TeamStanding | Absent {
  const row = table.get(teamId);
  if (!row) {
    return { value: null, reason: ABSENCE_REASONS.NO_PRIOR_FIXTURES };
  }
  return row;
}
