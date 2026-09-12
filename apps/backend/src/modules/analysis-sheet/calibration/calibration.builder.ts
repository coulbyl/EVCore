// Bloc `calibration` — calculs purs sur les agrégats SQL.
//
// Mesure de référence : `calibrationRatio` = fréquence observée ÷ probabilité
// moyenne annoncée. C'est la seule grandeur exploitable à nos volumes.
//
// ⚠ `roi` est calculé et exposé parce qu'il est demandé, mais il n'a AUCUNE
// puissance statistique ici : erreur-type de 13 à 18 points pour des écarts de
// 10 points (audit 2026-08-22, docs/audit-canaux-investir-2026-08-22.md).
// Une décision prise sur le ROI d'une cellule serait prise sur du bruit.

import Decimal from 'decimal.js';
import { round } from '@utils/decimal.utils';
import type {
  CalibrationBlock,
  CalibrationCell,
  LambdaBiasCell,
} from '../analysis-sheet-v2.types';
import type {
  CalibrationExclusions,
  CalibrationRow,
  LambdaBiasRow,
} from '../analysis-sheet-v2.repository';

function ratio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return round(new Decimal(numerator).div(denominator));
}

export function buildCalibrationCell(row: CalibrationRow): CalibrationCell {
  const observedFrequency = ratio(row.wins, row.n);
  const avgPredicted = ratio(row.sumProbability, row.n);

  return {
    market: row.market,
    competitionCode: row.competitionCode,
    competitionName: row.competitionName,
    n: row.n,
    wins: row.wins,
    losses: row.losses,
    hitRate: observedFrequency,
    avgPredictedProbability: avgPredicted,
    observedFrequency,
    calibrationRatio:
      observedFrequency !== null && avgPredicted !== null && avgPredicted > 0
        ? round(new Decimal(observedFrequency).div(avgPredicted))
        : null,
    brierScore: ratio(row.sumBrier, row.n),
    // Mise unitaire : le retour cumulé rapporté au nombre de mises.
    roi: ratio(row.sumReturn, row.n),
  };
}

export function buildLambdaBiasCell(row: LambdaBiasRow): LambdaBiasCell {
  const { avgPredictedGoals, avgActualGoals } = row;

  return {
    competitionCode: row.competitionCode,
    competitionName: row.competitionName,
    n: row.n,
    avgPredictedGoals,
    avgActualGoals,
    bias:
      avgPredictedGoals !== null && avgActualGoals !== null
        ? round(new Decimal(avgPredictedGoals).minus(avgActualGoals))
        : null,
    // Forme directement réutilisable comme LAMBDA_SCALE : réel ÷ prédit.
    ratio:
      avgPredictedGoals !== null &&
      avgActualGoals !== null &&
      avgPredictedGoals > 0
        ? round(new Decimal(avgActualGoals).div(avgPredictedGoals))
        : null,
  };
}

export function buildCalibrationBlock(input: {
  rows: readonly CalibrationRow[];
  lambdaBiasRows: readonly LambdaBiasRow[];
  exclusions: CalibrationExclusions;
  settledThrough: Date | null;
}): CalibrationBlock {
  const cells = input.rows.map(buildCalibrationCell);

  return {
    settledThrough: input.settledThrough?.toISOString() ?? null,
    totalSettled: cells.reduce((sum, cell) => sum + cell.n, 0),
    exclusions: input.exclusions,
    // Tri décroissant sur n : les cellules les plus fournies d'abord, parce que
    // ce sont les seules sur lesquelles une lecture tient. Ce n'est pas un
    // classement de qualité — la fiche ne classe pas.
    byMarketAndCompetition: [...cells].sort((a, b) => b.n - a.n),
    lambdaBiasByCompetition: input.lambdaBiasRows
      .map(buildLambdaBiasCell)
      .sort((a, b) => b.n - a.n),
  };
}

/** Index (marché, compétition) → cellule, pour rattacher la fiabilité au legPool. */
export function indexCalibration(
  cells: readonly CalibrationCell[],
): Map<string, CalibrationCell> {
  const index = new Map<string, CalibrationCell>();
  for (const cell of cells) {
    index.set(`${cell.market}:${cell.competitionCode}`, cell);
  }
  return index;
}
