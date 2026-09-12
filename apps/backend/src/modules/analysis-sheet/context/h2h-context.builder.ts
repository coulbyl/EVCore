// Bloc H2H détaillé de la fiche v2 — calcul pur.
//
// La v1 n'exposait qu'un scalaire non documenté (`model.shadowSignals.h2h`),
// null sur 38 % des matchs sans que rien ne dise pourquoi. Ce bloc rend la
// confrontation vérifiable : les rencontres brutes, leurs agrégats, et la
// formule exacte du scalaire avec ses paramètres.
//
// Rien n'est recalculé « à notre façon » : les constantes viennent de
// @evcore/analysis-core, donc le `formula` documenté ici décrit bien le code
// qui tourne en production (packages/analysis-core/src/probability/h2h.ts).

import {
  H2H_DECAY,
  H2H_DRAW_SCORE,
  H2H_MIN_SAMPLE,
} from '@evcore/analysis-core';
import Decimal from 'decimal.js';
import { round } from '@utils/decimal.utils';
import {
  ABSENCE_REASONS,
  type H2HAggregates,
  type H2HBlock,
  type H2HMeeting,
  type H2HScoreExplanation,
} from '../analysis-sheet-v2.types';

/** Nombre de confrontations exposées dans la fiche (le moteur, lui, en lit 5). */
export const H2H_SHEET_LIMIT = 10;

/**
 * Une confrontation passée, telle que lue en base — non orientée : `homeTeamId`
 * est l'équipe qui recevait CE JOUR-LÀ, pas celle qui reçoit dans le match décrit.
 */
export type H2HFixtureRow = {
  fixtureId: string;
  scheduledAt: Date;
  competitionCode: string;
  competitionName: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  homeHtScore: number | null;
  awayHtScore: number | null;
};

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return round(new Decimal(numerator).div(denominator));
}

/**
 * Réoriente une confrontation du point de vue du match décrit : le premier
 * score est toujours celui de l'équipe qui reçoit DANS LE MATCH DÉCRIT, quel
 * que soit le lieu de la rencontre passée. Sans ça, un agrégat « victoires »
 * mélangerait les deux sens.
 */
export function toMeeting(row: H2HFixtureRow, homeTeamId: string): H2HMeeting {
  const wasHome = row.homeTeamId === homeTeamId;

  return {
    fixtureId: row.fixtureId,
    date: row.scheduledAt.toISOString(),
    competitionCode: row.competitionCode,
    competitionName: row.competitionName,
    venueForHomeTeam: wasHome ? 'HOME' : 'AWAY',
    score: {
      homeTeam: wasHome ? row.homeScore : row.awayScore,
      awayTeam: wasHome ? row.awayScore : row.homeScore,
    },
    halfTimeScore:
      row.homeHtScore !== null && row.awayHtScore !== null
        ? {
            homeTeam: wasHome ? row.homeHtScore : row.awayHtScore,
            awayTeam: wasHome ? row.awayHtScore : row.homeHtScore,
          }
        : null,
  };
}

export function buildH2HAggregates(
  meetings: readonly H2HMeeting[],
): H2HAggregates {
  let homeTeamWins = 0;
  let draws = 0;
  let awayTeamWins = 0;
  let totalGoals = 0;
  let over15 = 0;
  let over25 = 0;
  let btts = 0;

  for (const meeting of meetings) {
    const { homeTeam, awayTeam } = meeting.score;
    if (homeTeam > awayTeam) homeTeamWins += 1;
    else if (homeTeam < awayTeam) awayTeamWins += 1;
    else draws += 1;

    const total = homeTeam + awayTeam;
    totalGoals += total;
    if (total >= 2) over15 += 1;
    if (total >= 3) over25 += 1;
    if (homeTeam > 0 && awayTeam > 0) btts += 1;
  }

  const n = meetings.length;

  return {
    sampleSize: n,
    homeTeamWins,
    draws,
    awayTeamWins,
    goalsPerMatch: n > 0 ? round(new Decimal(totalGoals).div(n)) : null,
    over15Rate: rate(over15, n),
    over25Rate: rate(over25, n),
    bttsRate: rate(btts, n),
  };
}

const H2H_FORMULA =
  'h2h = Σ(0.8^i × outcome_i) / Σ(0.8^i), i = 0 pour la confrontation la plus ' +
  'récente ; outcome = 1 si le favori gagne, 0.5 si nul, 0 sinon. ' +
  'Calculé sur les 5 dernières confrontations, null en dessous de 3.';

const H2H_INTERPRETATION =
  'Taux de victoire du FAVORI dans cette confrontation, pondéré par la récence, ' +
  'les nuls comptant pour un demi. 0.5 = neutre ; > 0.5 = l’historique confirme ' +
  'le favori ; < 0.5 = il le contredit. Le favori est déterminé AVANT correction ' +
  '(probabilités 1X2 de base), donc sans circularité.';

/**
 * Explicitation du scalaire `shadow_h2h`.
 *
 * `favorite` est reconstruit depuis les probabilités 1X2 publiées : le moteur
 * le décide sur les probabilités de BASE, antérieures aux corrections, et ne
 * l'enregistre pas. Dans la très grande majorité des cas les deux coïncident ;
 * quand les probabilités manquent, on rend `null` plutôt qu'une supposition.
 */
export function buildH2HScoreExplanation(input: {
  value: number | null;
  sampleSize: number | null;
  homeProbability: number | null;
  awayProbability: number | null;
}): H2HScoreExplanation {
  const { value, sampleSize, homeProbability, awayProbability } = input;

  const favorite =
    homeProbability !== null && awayProbability !== null
      ? homeProbability >= awayProbability
        ? ('HOME' as const)
        : ('AWAY' as const)
      : null;

  const reason =
    value !== null
      ? null
      : sampleSize !== null && sampleSize < H2H_MIN_SAMPLE
        ? ABSENCE_REASONS.SAMPLE_TOO_SMALL
        : ABSENCE_REASONS.NO_PRIOR_FIXTURES;

  return {
    value,
    reason,
    favorite: value !== null ? favorite : null,
    sampleSize,
    minSample: H2H_MIN_SAMPLE,
    decay: H2H_DECAY.toNumber(),
    drawScore: H2H_DRAW_SCORE.toNumber(),
    formula: H2H_FORMULA,
    interpretation: H2H_INTERPRETATION,
  };
}

export function buildH2HBlock(input: {
  rows: readonly H2HFixtureRow[];
  homeTeamId: string;
  shadowH2h: number | null;
  shadowH2hSampleSize: number | null;
  homeProbability: number | null;
  awayProbability: number | null;
}): H2HBlock {
  const meetings = input.rows
    .slice(0, H2H_SHEET_LIMIT)
    .map((row) => toMeeting(row, input.homeTeamId));

  return {
    meetings,
    aggregates: buildH2HAggregates(meetings),
    score: buildH2HScoreExplanation({
      value: input.shadowH2h,
      sampleSize: input.shadowH2hSampleSize,
      homeProbability: input.homeProbability,
      awayProbability: input.awayProbability,
    }),
  };
}
