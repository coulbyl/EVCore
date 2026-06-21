import { Injectable } from '@nestjs/common';
import type { Prisma } from '@evcore/db';
import { parseIsoDate, startOfUtcDay, endOfUtcDay } from '@utils/date.utils';
import {
  BacktestRepository,
  type ModelProbabilityRow,
} from './backtest.repository';
import {
  brierScoreOneXTwo,
  calibrationError,
  getOneXTwoOutcome,
  type CalibrationPoint,
  type OneXTwoPrediction,
} from './backtest.report';
import {
  BACKTEST_CONSTANTS,
  getBrierScorePassThreshold,
} from './backtest.constants';
import type {
  BacktestVerdict,
  ModelCalibrationReport,
  ModelCalibrationResponse,
} from './dto/backtest-channels.dto';

function readOneXTwo(
  features: Prisma.JsonValue,
): { home: number; draw: number; away: number } | null {
  if (!features || typeof features !== 'object' || Array.isArray(features)) {
    return null;
  }
  const probs = (features as Record<string, unknown>)['probabilities'];
  if (!probs || typeof probs !== 'object') return null;
  const p = probs as Record<string, unknown>;
  const home = p['home'];
  const draw = p['draw'];
  const away = p['away'];
  if (
    typeof home !== 'number' ||
    typeof draw !== 'number' ||
    typeof away !== 'number'
  ) {
    return null;
  }
  return { home, draw, away };
}

function buildReport(input: {
  competitionCode: string;
  competitionName: string;
  rows: ModelProbabilityRow[];
  minSample: number;
}): ModelCalibrationReport {
  const { competitionCode, competitionName, rows, minSample } = input;
  const predictions: OneXTwoPrediction[] = [];
  const points: CalibrationPoint[] = [];

  for (const row of rows) {
    const probs = readOneXTwo(row.features);
    if (!probs) continue;
    const actual = getOneXTwoOutcome(row.homeScore, row.awayScore);
    predictions.push({ ...probs, actual });
    // Flatten the 3 class probabilities into calibration points.
    points.push({ prob: probs.home, actual: actual === 'HOME' ? 1 : 0 });
    points.push({ prob: probs.draw, actual: actual === 'DRAW' ? 1 : 0 });
    points.push({ prob: probs.away, actual: actual === 'AWAY' ? 1 : 0 });
  }

  const brierScore = brierScoreOneXTwo(predictions);
  const ece = calibrationError(points);
  const brierThreshold = getBrierScorePassThreshold(competitionCode).toNumber();
  const eceThreshold =
    BACKTEST_CONSTANTS.CALIBRATION_ERROR_PASS_THRESHOLD.toNumber();

  let verdict: BacktestVerdict;
  if (predictions.length < minSample) {
    verdict = 'INSUFFICIENT_DATA';
  } else {
    verdict =
      brierScore <= brierThreshold && ece <= eceThreshold ? 'PASS' : 'FAIL';
  }

  return {
    competitionCode,
    competitionName,
    analyzedCount: predictions.length,
    brierScore,
    calibrationError: ece,
    verdict,
  };
}

function dateRange(from?: string, to?: string) {
  const today = new Date();
  const toDate = to
    ? endOfUtcDay(parseIsoDate(to))
    : endOfUtcDay(new Date(today.getTime() - 86_400_000));
  const fromDate = from
    ? startOfUtcDay(parseIsoDate(from))
    : startOfUtcDay(new Date(today.getTime() - 365 * 86_400_000));
  return {
    from: fromDate,
    to: toDate,
    fromIso: fromDate.toISOString().slice(0, 10),
    toIso: toDate.toISOString().slice(0, 10),
  };
}

/**
 * Model-quality backtest (Brier / ECE on 1X2), per competition — channel-agnostic.
 * It measures the Poisson substrate, not a channel's staking performance. Reads
 * `model_run.features`; never re-runs the engine.
 */
@Injectable()
export class ModelCalibrationService {
  constructor(private readonly repo: BacktestRepository) {}

  async run(query: {
    from?: string;
    to?: string;
    competitionCode?: string;
  }): Promise<ModelCalibrationResponse> {
    const range = dateRange(query.from, query.to);
    const minSample = BACKTEST_CONSTANTS.MIN_FIXTURES_FOR_VALIDATION;

    const rows = await this.repo.findModelProbabilityRows({
      from: range.from,
      to: range.to,
      competitionCode: query.competitionCode,
    });

    const byComp = new Map<string, ModelProbabilityRow[]>();
    for (const row of rows) {
      const list = byComp.get(row.competitionCode) ?? [];
      list.push(row);
      byComp.set(row.competitionCode, list);
    }

    const reports = [...byComp.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, group]) =>
        buildReport({
          competitionCode: code,
          competitionName: group[0]?.competitionName ?? code,
          rows: group,
          minSample,
        }),
      );

    return {
      from: range.fromIso,
      to: range.toIso,
      minSample,
      brierPassThreshold:
        BACKTEST_CONSTANTS.BRIER_SCORE_PASS_THRESHOLD.toNumber(),
      calibrationPassThreshold:
        BACKTEST_CONSTANTS.CALIBRATION_ERROR_PASS_THRESHOLD.toNumber(),
      reports,
    };
  }
}
