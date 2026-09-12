// Calculs purs du bloc `context` de la fiche v2 — forme, buts, xG, calendrier.
//
// Aucune I/O ici : l'appelant fournit la liste des matchs ANTÉRIEURS au coup
// d'envoi (analysis-sheet-v2.repository.ts la borne sur `scheduledAt < kickoff`),
// ce qui rend l'absence de fuite de données vérifiable par simple lecture.
//
// Arithmétique : chaque taux passe par decimal.js (règle projet), même s'il
// s'agit de statistiques descriptives et non d'un calcul de mise.

import Decimal from 'decimal.js';
import { round } from '@utils/decimal.utils';
import {
  ABSENCE_REASONS,
  type Absent,
  type FormWindow,
  type GoalsSplit,
  type SeasonGoals,
  type TeamForm,
  type TeamGoals,
  type TeamSchedule,
  type TeamXg,
  type XgSource,
} from '../analysis-sheet-v2.types';

/**
 * Un match déjà joué, vu DU POINT DE VUE d'une équipe donnée (les buts sont
 * déjà orientés « pour » / « contre »).
 */
export type PriorFixture = {
  fixtureId: string;
  scheduledAt: Date;
  competitionCode: string;
  competitionName: string;
  seasonName: string;
  /** L'équipe recevait-elle lors de CE match. */
  isHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  /** Score à la mi-temps, même orientation. null si non collecté. */
  htGoalsFor: number | null;
  htGoalsAgainst: number | null;
  xgFor: number | null;
  xgAgainst: number | null;
};

/** Fenêtre xG alignée sur TeamStats.xgFor/xgAgainst (roulant 10 matchs). */
export const XG_WINDOW = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Taux borné [0,1], via decimal.js. null quand le dénominateur est nul. */
function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return round(new Decimal(numerator).div(denominator));
}

/** Moyenne par match, via decimal.js. null quand l'échantillon est vide. */
function perMatch(total: number, count: number): number | null {
  if (count <= 0) return null;
  return round(new Decimal(total).div(count));
}

function outcomeOf(fixture: PriorFixture): 'W' | 'D' | 'L' {
  if (fixture.goalsFor > fixture.goalsAgainst) return 'W';
  if (fixture.goalsFor < fixture.goalsAgainst) return 'L';
  return 'D';
}

/**
 * L'équipe a-t-elle gagné au moins une des deux mi-temps.
 *
 * 1re mi-temps = score à la pause. 2e mi-temps = score final − score à la pause.
 * Retourne null quand le score à la mi-temps manque : c'est une inconnue, pas
 * un « non ».
 */
export function wonEitherHalf(fixture: PriorFixture): boolean | null {
  const { htGoalsFor, htGoalsAgainst } = fixture;
  if (htGoalsFor === null || htGoalsAgainst === null) return null;

  const firstHalfWon = htGoalsFor > htGoalsAgainst;
  const secondHalfWon =
    fixture.goalsFor - htGoalsFor > fixture.goalsAgainst - htGoalsAgainst;

  return firstHalfWon || secondHalfWon;
}

// ─────────────────────────────────────────────────────────────────────────────
// context.form
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bilan sur les `window` matchs les plus récents de `fixtures`.
 * `fixtures` doit être trié du plus récent au plus ancien.
 */
export function buildFormWindow(
  fixtures: readonly PriorFixture[],
  window: number,
): FormWindow {
  const sample = fixtures.slice(0, window);

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  const sequence: string[] = [];

  for (const fixture of sample) {
    const outcome = outcomeOf(fixture);
    sequence.push(outcome);
    if (outcome === 'W') wins += 1;
    else if (outcome === 'D') draws += 1;
    else losses += 1;
    goalsFor += fixture.goalsFor;
    goalsAgainst += fixture.goalsAgainst;
  }

  const points = wins * 3 + draws;

  return {
    window,
    sampleSize: sample.length,
    sequence: sequence.join(''),
    wins,
    draws,
    losses,
    points,
    pointsPerMatch: perMatch(points, sample.length),
    goalsFor,
    goalsAgainst,
    goalsForPerMatch: perMatch(goalsFor, sample.length),
    goalsAgainstPerMatch: perMatch(goalsAgainst, sample.length),
  };
}

export function buildTeamForm(
  fixtures: readonly PriorFixture[],
  venue: 'HOME' | 'AWAY',
): TeamForm {
  const sameVenue = fixtures.filter((f) =>
    venue === 'HOME' ? f.isHome : !f.isHome,
  );

  return {
    last5: buildFormWindow(fixtures, 5),
    last10: buildFormWindow(fixtures, 10),
    last5SameVenue: buildFormWindow(sameVenue, 5),
    venue,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// context.goals
// ─────────────────────────────────────────────────────────────────────────────

export function buildGoalsSplit(fixtures: readonly PriorFixture[]): GoalsSplit {
  let goalsFor = 0;
  let goalsAgainst = 0;
  let over15 = 0;
  let over25 = 0;
  let btts = 0;
  let cleanSheets = 0;
  let failedToScore = 0;
  let winEitherHalf = 0;
  let halfTimeSampleSize = 0;

  for (const fixture of fixtures) {
    const total = fixture.goalsFor + fixture.goalsAgainst;
    goalsFor += fixture.goalsFor;
    goalsAgainst += fixture.goalsAgainst;
    if (total >= 2) over15 += 1;
    if (total >= 3) over25 += 1;
    if (fixture.goalsFor > 0 && fixture.goalsAgainst > 0) btts += 1;
    if (fixture.goalsAgainst === 0) cleanSheets += 1;
    if (fixture.goalsFor === 0) failedToScore += 1;

    const eitherHalf = wonEitherHalf(fixture);
    if (eitherHalf !== null) {
      halfTimeSampleSize += 1;
      if (eitherHalf) winEitherHalf += 1;
    }
  }

  const n = fixtures.length;

  return {
    sampleSize: n,
    goalsForPerMatch: perMatch(goalsFor, n),
    goalsAgainstPerMatch: perMatch(goalsAgainst, n),
    over15Rate: rate(over15, n),
    over25Rate: rate(over25, n),
    bttsRate: rate(btts, n),
    cleanSheetRate: rate(cleanSheets, n),
    failedToScoreRate: rate(failedToScore, n),
    // Rapporté au sous-échantillon qui porte réellement un score à la pause,
    // pas à `n` — sinon l'absence de donnée se lirait comme un échec.
    winEitherHalfRate: rate(winEitherHalf, halfTimeSampleSize),
    halfTimeSampleSize,
  };
}

function buildSeasonGoals(
  fixtures: readonly PriorFixture[],
  seasonName: string,
): SeasonGoals {
  return {
    seasonName,
    all: buildGoalsSplit(fixtures),
    home: buildGoalsSplit(fixtures.filter((f) => f.isHome)),
    away: buildGoalsSplit(fixtures.filter((f) => !f.isHome)),
  };
}

/**
 * Buts sur la saison en cours et la précédente.
 *
 * Les saisons sont identifiées par `seasonName` tel qu'il figure en base, et
 * ordonnées par ordre décroissant de nom (convention "2026-27" > "2025-26").
 * `currentSeasonName` ancre la saison en cours sur celle du match décrit, pas
 * sur la plus récente rencontrée — une équipe qui n'a encore rien joué cette
 * saison doit rendre un échantillon vide, pas la saison passée déguisée.
 */
export function buildTeamGoals(
  fixtures: readonly PriorFixture[],
  currentSeasonName: string | null,
): TeamGoals {
  if (fixtures.length === 0) {
    const absent: Absent = {
      value: null,
      reason: ABSENCE_REASONS.NO_PRIOR_FIXTURES,
    };
    return { currentSeason: absent, previousSeason: absent };
  }

  const seasonNames = [...new Set(fixtures.map((f) => f.seasonName))].sort(
    (a, b) => b.localeCompare(a),
  );
  const current = currentSeasonName ?? seasonNames[0] ?? null;
  const previous =
    seasonNames.find((name) => current === null || name < current) ?? null;

  const forSeason = (name: string | null): SeasonGoals | Absent => {
    if (name === null) {
      return { value: null, reason: ABSENCE_REASONS.NO_PRIOR_FIXTURES };
    }
    const sample = fixtures.filter((f) => f.seasonName === name);
    if (sample.length === 0) {
      return { value: null, reason: ABSENCE_REASONS.NO_PRIOR_FIXTURES };
    }
    return buildSeasonGoals(sample, name);
  };

  return {
    currentSeason: forSeason(current),
    previousSeason: forSeason(previous),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// context.xg
// ─────────────────────────────────────────────────────────────────────────────

/**
 * xG pour/contre sur les `window` derniers matchs qui en portent.
 *
 * `source` vaut toujours "unverifiable" quand des xG existent : la colonne
 * `fixture.homeXg` mélange le xG d'API-Football et un proxy `tirs cadrés × 0.4`
 * sans marqueur de provenance (audit 2026-09-12 §2.2). Annoncer "api_football"
 * serait une affirmation non vérifiable — la règle « aucune donnée inventée »
 * impose de le dire plutôt que de le supposer.
 */
export function buildTeamXg(
  fixtures: readonly PriorFixture[],
  window: number = XG_WINDOW,
): TeamXg {
  const withXg = fixtures
    .filter((f) => f.xgFor !== null && f.xgAgainst !== null)
    .slice(0, window);

  if (withXg.length === 0) {
    const source: XgSource = 'unverifiable';
    return {
      window,
      matchesWithXg: 0,
      xgForPerMatch: null,
      xgAgainstPerMatch: null,
      source,
      reason:
        fixtures.length === 0
          ? ABSENCE_REASONS.NO_PRIOR_FIXTURES
          : ABSENCE_REASONS.NO_DATA_IN_SAMPLE,
    };
  }

  const totals = withXg.reduce(
    (acc, f) => ({
      for: acc.for.plus(f.xgFor ?? 0),
      against: acc.against.plus(f.xgAgainst ?? 0),
    }),
    { for: new Decimal(0), against: new Decimal(0) },
  );

  return {
    window,
    matchesWithXg: withXg.length,
    xgForPerMatch: round(totals.for.div(withXg.length)),
    xgAgainstPerMatch: round(totals.against.div(withXg.length)),
    source: 'unverifiable',
    reason: ABSENCE_REASONS.PROVENANCE_NOT_RECORDED,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// context.schedule
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const SCHEDULE_WINDOW_DAYS = 4;

/** Un match à venir (ou tout proche) servant au calcul de la densité de calendrier. */
export type NearbyFixture = {
  scheduledAt: Date;
  competitionCode: string;
};

/**
 * Repos et densité de calendrier autour du coup d'envoi.
 *
 * `priorFixtures` est trié du plus récent au plus ancien ; `nearbyFixtures`
 * contient les matchs de l'équipe dans la fenêtre ±4 jours (le match décrit
 * lui-même exclu par l'appelant).
 */
export function buildTeamSchedule(input: {
  kickoff: Date;
  priorFixtures: readonly PriorFixture[];
  nearbyFixtures: readonly NearbyFixture[];
  /** Compétition du match décrit — sert à repérer une coupe ou l'Europe. */
  competitionCode: string;
}): TeamSchedule {
  const { kickoff, priorFixtures, nearbyFixtures, competitionCode } = input;
  const last = priorFixtures[0] ?? null;

  const restDays =
    last === null
      ? null
      : Math.floor((kickoff.getTime() - last.scheduledAt.getTime()) / DAY_MS);

  const windowMs = SCHEDULE_WINDOW_DAYS * DAY_MS;
  const inWindow = nearbyFixtures.filter(
    (f) => Math.abs(f.scheduledAt.getTime() - kickoff.getTime()) <= windowMs,
  );

  const other = inWindow
    .filter((f) => f.competitionCode !== competitionCode)
    .sort(
      (a, b) =>
        Math.abs(a.scheduledAt.getTime() - kickoff.getTime()) -
        Math.abs(b.scheduledAt.getTime() - kickoff.getTime()),
    )[0];

  return {
    restDays,
    lastMatchAt: last?.scheduledAt.toISOString() ?? null,
    lastMatchCompetitionCode: last?.competitionCode ?? null,
    fixturesNext4Days: inWindow.filter(
      (f) => f.scheduledAt.getTime() > kickoff.getTime(),
    ).length,
    fixturesPrev4Days: inWindow.filter(
      (f) => f.scheduledAt.getTime() < kickoff.getTime(),
    ).length,
    otherCompetitionWithin4Days: other
      ? {
          competitionCode: other.competitionCode,
          scheduledAt: other.scheduledAt.toISOString(),
          side:
            other.scheduledAt.getTime() < kickoff.getTime()
              ? 'BEFORE'
              : 'AFTER',
        }
      : null,
  };
}
