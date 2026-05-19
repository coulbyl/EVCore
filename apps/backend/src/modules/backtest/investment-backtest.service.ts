import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import { createLogger } from '@utils/logger';
import { getPredictionConfig } from '@modules/prediction/prediction.constants';
import { BacktestService, type InvestmentPickRecord } from './backtest.service';

const logger = createLogger('investment-backtest');

type Canal = InvestmentPickRecord['canal'];
const CANALS: Canal[] = ['EV', 'SV', 'BB', 'NUL', 'CONF'];
const DOW_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

const CANAL_BASE_WEIGHT: Record<Canal, number> = {
  SV: 0.74,
  CONF: 0.66,
  BB: 0.62,
  EV: 0.36,
  NUL: 0.2,
};

const FALLBACK_ODDS: Record<Canal, number> = {
  SV: 1.65,
  CONF: 2.2,
  BB: 1.75,
  EV: 1.85,
  NUL: 3.2,
};

// ── Types ──────────────────────────────────────────────────────────────────────

export type InvestmentBacktestParams = {
  k: number;
  minCalibratedJointProbability: number;
  maxLegs: number;
  maxCombinedOdds: number;
  capMin: number;
  capMax: number;
  recencyWeighting: 'flat' | 'exponential_decay_14d';
  nLeagueMin: number;
  couponMinSample: Record<Canal, number>;
  includeConfInCoupons: boolean;
  windowDays: number;
};

type CalibratedRates = {
  canal: Record<Canal, number>;
  canalLeague: Record<Canal, Record<string, number>>;
};

type ScoredPick = InvestmentPickRecord & {
  calibratedHitRate: number;
  signalScore: number;
};

type SimulatedCoupon = {
  legs: ScoredPick[];
  combinedOdds: number;
  calibratedJointProbability: number;
  score: number;
  won: boolean;
};

export type InvestmentBacktestResult = {
  params: InvestmentBacktestParams;
  totalCoupons: number;
  wonCoupons: number;
  hitRate: number;
  roi: number;
  maxDrawdown: number;
  activeDays: number;
};

export type InvestmentBacktestOutput = {
  selectedParams: InvestmentBacktestParams;
  trainResult: InvestmentBacktestResult;
  testResult: InvestmentBacktestResult;
  correlationMatrix: Record<string, number>;
  confByLeague: {
    league: string;
    month: string;
    total: number;
    correct: number;
    hitRate: number;
  }[];
  gridSearchRows: GridSearchRow[];
  generatedAt: string;
};

type GridSearchRow = {
  step: number;
  k: number;
  minCalibratedJointProbability: number;
  maxLegs: number;
  maxCombinedOdds: number;
  capMin: number;
  capMax: number;
  recencyWeighting: string;
  nLeagueMin: number;
  includeConf: boolean;
  trainCoupons: number;
  trainHitRate: number;
  trainRoi: number;
  testCoupons: number;
  testHitRate: number;
  testRoi: number;
  testMaxDrawdown: number;
  verdict: 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA';
};

// ── Bayesian calibration ───────────────────────────────────────────────────────

function calibrate(
  wins: number,
  n: number,
  prior: number,
  k: number,
  capMin: number,
  capMax: number,
): number {
  const raw = (wins + k * prior) / (n + k);
  return Math.max(capMin, Math.min(capMax, raw));
}

function decayWeight(
  day: string,
  beforeDate: Date,
  halfLifeDays: number,
): number {
  const daysAgo =
    (beforeDate.getTime() - new Date(day + 'T12:00:00Z').getTime()) /
    86_400_000;
  return Math.pow(0.5, daysAgo / halfLifeDays);
}

function computeCalibratedRates(
  data: InvestmentPickRecord[],
  beforeDate: Date,
  params: InvestmentBacktestParams,
): CalibratedRates {
  const windowStart = new Date(
    beforeDate.getTime() - params.windowDays * 86_400_000,
  );
  const window = data.filter((r) => {
    const d = new Date(r.day + 'T12:00:00Z');
    return d >= windowStart && d < beforeDate;
  });

  function weightedHits(filter: (r: InvestmentPickRecord) => boolean): {
    correct: number;
    total: number;
  } {
    let correct = 0;
    let total = 0;
    for (const r of window) {
      if (!filter(r)) continue;
      const w =
        params.recencyWeighting === 'exponential_decay_14d'
          ? decayWeight(r.day, beforeDate, 14)
          : 1;
      total += w;
      if (r.correct) correct += w;
    }
    return { correct, total };
  }

  const canalRates = {} as Record<Canal, number>;
  for (const canal of CANALS) {
    const { correct, total } = weightedHits((r) => r.canal === canal);
    canalRates[canal] = calibrate(
      correct,
      total,
      CANAL_BASE_WEIGHT[canal],
      params.k,
      params.capMin,
      params.capMax,
    );
  }

  const allLeagues = [...new Set(window.map((r) => r.competition))];
  const canalLeagueRates = {} as Record<Canal, Record<string, number>>;
  for (const canal of CANALS) {
    canalLeagueRates[canal] = {};
    for (const league of allLeagues) {
      const { correct, total } = weightedHits(
        (r) => r.canal === canal && r.competition === league,
      );
      if (total >= params.nLeagueMin) {
        canalLeagueRates[canal][league] = calibrate(
          correct,
          total,
          canalRates[canal],
          params.k,
          params.capMin,
          params.capMax,
        );
      }
    }
  }

  return { canal: canalRates, canalLeague: canalLeagueRates };
}

// ── Coupon composition ─────────────────────────────────────────────────────────

function scorePick(
  pick: InvestmentPickRecord,
  rates: CalibratedRates,
): ScoredPick {
  const windowRate = rates.canal[pick.canal];
  const leagueRate =
    rates.canalLeague[pick.canal]?.[pick.competition] ?? windowRate;
  const signalScore = windowRate * 0.5 + leagueRate * 0.5;
  return { ...pick, calibratedHitRate: leagueRate, signalScore };
}

function composeCoupons(
  picks: InvestmentPickRecord[],
  rates: CalibratedRates,
  params: InvestmentBacktestParams,
): SimulatedCoupon[] {
  const eligibleCanals = new Set<Canal>(
    CANALS.filter((c) => params.includeConfInCoupons || c !== 'CONF'),
  );

  const eligible = picks.filter((p) => eligibleCanals.has(p.canal));
  if (eligible.length < 2) return [];

  const scored = eligible.map((p) => scorePick(p, rates));
  scored.sort((a, b) => b.signalScore - a.signalScore);

  const candidates: SimulatedCoupon[] = [];
  buildCombinations(scored, [], params, candidates);

  candidates.sort((a, b) => {
    const aScore =
      a.calibratedJointProbability *
      (a.legs.reduce((s, l) => s + l.signalScore, 0) / a.legs.length);
    const bScore =
      b.calibratedJointProbability *
      (b.legs.reduce((s, l) => s + l.signalScore, 0) / b.legs.length);
    return bScore - aScore;
  });

  const seen = new Set<string>();
  return candidates
    .filter((c) => {
      const key = c.legs
        .map((l) => `${l.fixtureId}:${l.canal}`)
        .sort()
        .join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

function buildCombinations(
  remaining: ScoredPick[],
  current: ScoredPick[],
  params: InvestmentBacktestParams,
  out: SimulatedCoupon[],
): void {
  if (current.length >= 2) {
    const combinedOdds = current.reduce(
      (acc, l) => acc * (l.oddsSnapshot ?? FALLBACK_ODDS[l.canal]),
      1,
    );

    if (combinedOdds <= params.maxCombinedOdds) {
      const calibratedJointProbability = current.reduce(
        (acc, l) => acc * l.calibratedHitRate,
        1,
      );

      if (calibratedJointProbability >= params.minCalibratedJointProbability) {
        out.push({
          legs: [...current],
          combinedOdds,
          calibratedJointProbability,
          score:
            calibratedJointProbability *
            (current.reduce((s, l) => s + l.signalScore, 0) / current.length),
          won: current.every((l) => l.correct),
        });
      }

      if (current.length < params.maxLegs) {
        for (let i = 0; i < remaining.length; i++) {
          const next = remaining[i]!;
          // Anti-correlation rules
          if (current.some((p) => p.fixtureId === next.fixtureId)) continue;
          if (
            current.some(
              (p) => p.canal === next.canal && p.market === next.market,
            )
          )
            continue;
          buildCombinations(
            remaining.slice(i + 1),
            [...current, next],
            params,
            out,
          );
        }
      }
      return;
    }
    return;
  }

  for (let i = 0; i < remaining.length; i++) {
    const next = remaining[i]!;
    if (current.some((p) => p.fixtureId === next.fixtureId)) continue;
    buildCombinations(remaining.slice(i + 1), [...current, next], params, out);
  }
}

// ── Single-params backtest run ─────────────────────────────────────────────────

function runBacktest(
  data: InvestmentPickRecord[],
  days: string[],
  params: InvestmentBacktestParams,
): InvestmentBacktestResult {
  let totalCoupons = 0;
  let wonCoupons = 0;
  let pnl = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let activeDays = 0;

  // Group picks by day once
  const byDay = new Map<string, InvestmentPickRecord[]>();
  for (const r of data) {
    const list = byDay.get(r.day) ?? [];
    list.push(r);
    byDay.set(r.day, list);
  }

  for (const day of days) {
    const dayPicks = byDay.get(day);
    if (!dayPicks || dayPicks.length < 2) continue;

    const beforeDate = new Date(day + 'T00:00:00Z');
    const rates = computeCalibratedRates(data, beforeDate, params);
    const coupons = composeCoupons(dayPicks, rates, params);
    if (coupons.length === 0) continue;

    activeDays++;
    for (const coupon of coupons) {
      totalCoupons++;
      const gain = coupon.won ? coupon.combinedOdds - 1 : -1;
      pnl += gain;
      if (pnl > peak) peak = pnl;
      const dd = peak - pnl;
      if (dd > maxDrawdown) maxDrawdown = dd;
      if (coupon.won) wonCoupons++;
    }
  }

  return {
    params,
    totalCoupons,
    wonCoupons,
    hitRate: totalCoupons > 0 ? wonCoupons / totalCoupons : 0,
    roi: totalCoupons > 0 ? pnl / totalCoupons : 0,
    maxDrawdown,
    activeDays,
  };
}

function verdict(
  result: InvestmentBacktestResult,
): 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA' {
  if (result.totalCoupons < 50) return 'INSUFFICIENT_DATA';
  if (
    result.hitRate >= 0.35 &&
    result.roi > -0.05 &&
    result.maxDrawdown <= 0.3 * result.totalCoupons
  )
    return 'PASS';
  return 'FAIL';
}

// ── Correlation matrix ─────────────────────────────────────────────────────────

function computeCorrelationMatrix(
  data: InvestmentPickRecord[],
): Record<string, number> {
  const days = [...new Set(data.map((r) => r.day))];
  const result: Record<string, number> = {};

  for (let i = 0; i < CANALS.length; i++) {
    for (let j = i; j < CANALS.length; j++) {
      const a = CANALS[i]!;
      const b = CANALS[j]!;
      let pAB = 0,
        pA = 0,
        pB = 0,
        n = 0;

      for (const day of days) {
        const dayData = data.filter((r) => r.day === day);
        const aRecs = dayData.filter((r) => r.canal === a);
        const bRecs = dayData.filter((r) => r.canal === b);
        if (aRecs.length === 0 || bRecs.length === 0) continue;
        const aHR = aRecs.filter((r) => r.correct).length / aRecs.length;
        const bHR = bRecs.filter((r) => r.correct).length / bRecs.length;
        const aHit = aRecs.some((r) => r.correct) ? 1 : 0;
        const bHit = bRecs.some((r) => r.correct) ? 1 : 0;
        pAB += aHit * bHit;
        pA += aHR;
        pB += bHR;
        n++;
      }

      if (n >= 10) {
        const mA = pA / n;
        const mB = pB / n;
        result[`${a}×${b}`] = mA > 0 && mB > 0 ? pAB / n / (mA * mB) : 1.0;
      }
    }
  }

  return result;
}

// ── CONF by league ─────────────────────────────────────────────────────────────

function computeConfByLeague(
  data: InvestmentPickRecord[],
): {
  league: string;
  month: string;
  total: number;
  correct: number;
  hitRate: number;
}[] {
  const map = new Map<string, { total: number; correct: number }>();
  for (const r of data.filter((r) => r.canal === 'CONF')) {
    const month = r.day.slice(0, 7);
    const key = `${r.competition}:${month}`;
    const entry = map.get(key) ?? { total: 0, correct: 0 };
    map.set(key, {
      total: entry.total + 1,
      correct: entry.correct + (r.correct ? 1 : 0),
    });
  }
  return [...map.entries()]
    .map(([key, { total, correct }]) => {
      const [league, month] = key.split(':') as [string, string];
      return {
        league,
        month,
        total,
        correct,
        hitRate: total > 0 ? correct / total : 0,
      };
    })
    .sort(
      (a, b) =>
        a.league.localeCompare(b.league) || a.month.localeCompare(b.month),
    );
}

// ── CSV helpers ────────────────────────────────────────────────────────────────

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => JSON.stringify(r[h] ?? '')).join(','),
    ),
  ];
  return lines.join('\n');
}

// ── Main service ───────────────────────────────────────────────────────────────

const TRAIN_END = '2026-04-01';
const TEST_END = '2026-05-19';

@Injectable()
export class InvestmentBacktestService {
  constructor(private readonly backtest: BacktestService) {}

  async run(): Promise<InvestmentBacktestOutput> {
    logger.info('Generating investment dataset...');
    const dataset = await this.backtest.generateInvestmentDataset();
    logger.info({ picks: dataset.length }, 'Dataset ready');

    const allDays = [...new Set(dataset.map((r) => r.day))].sort();
    const trainDays = allDays.filter((d) => d >= '2023-08-01' && d < TRAIN_END);
    const testDays = allDays.filter((d) => d >= TRAIN_END && d < TEST_END);

    logger.info(
      { trainDays: trainDays.length, testDays: testDays.length },
      'Split ready',
    );

    const gridSearchRows: GridSearchRow[] = [];

    // ── Step 1 : fix structural params, search k + caps + threshold ───────────
    const fixedParams: Omit<
      InvestmentBacktestParams,
      'k' | 'capMin' | 'capMax' | 'minCalibratedJointProbability'
    > = {
      maxLegs: 3,
      maxCombinedOdds: 6.0,
      recencyWeighting: 'flat',
      nLeagueMin: 15,
      windowDays: 38,
      includeConfInCoupons: true,
      couponMinSample: { SV: 10, BB: 10, EV: 5, CONF: 20, NUL: 20 },
    };

    let bestStep1: {
      params: InvestmentBacktestParams;
      testRoi: number;
    } | null = null;

    for (const k of [5, 10, 20, 50]) {
      for (const minCJP of [0.25, 0.3, 0.35, 0.4, 0.45]) {
        for (const capMin of [0.05, 0.1, 0.15]) {
          for (const capMax of [0.8, 0.85, 0.9]) {
            const params: InvestmentBacktestParams = {
              ...fixedParams,
              k,
              capMin,
              capMax,
              minCalibratedJointProbability: minCJP,
            };

            const trainResult = runBacktest(dataset, trainDays, params);
            const testResult = runBacktest(dataset, testDays, params);
            const v = verdict(testResult);

            gridSearchRows.push({
              step: 1,
              k,
              minCalibratedJointProbability: minCJP,
              maxLegs: params.maxLegs,
              maxCombinedOdds: params.maxCombinedOdds,
              capMin,
              capMax,
              recencyWeighting: params.recencyWeighting,
              nLeagueMin: params.nLeagueMin,
              includeConf: params.includeConfInCoupons,
              trainCoupons: trainResult.totalCoupons,
              trainHitRate: trainResult.hitRate,
              trainRoi: trainResult.roi,
              testCoupons: testResult.totalCoupons,
              testHitRate: testResult.hitRate,
              testRoi: testResult.roi,
              testMaxDrawdown: testResult.maxDrawdown,
              verdict: v,
            });

            if (
              v === 'PASS' &&
              (bestStep1 === null || testResult.roi > bestStep1.testRoi)
            ) {
              bestStep1 = { params, testRoi: testResult.roi };
            }
          }
        }
      }
    }

    const step1Params = bestStep1?.params ?? {
      ...fixedParams,
      k: 10,
      capMin: 0.1,
      capMax: 0.85,
      minCalibratedJointProbability: 0.35,
    };

    logger.info(
      {
        k: step1Params.k,
        capMin: step1Params.capMin,
        capMax: step1Params.capMax,
        threshold: step1Params.minCalibratedJointProbability,
      },
      'Step 1 best params',
    );

    // ── Step 2 : test includeConf ─────────────────────────────────────────────
    let bestStep2Params = step1Params;
    let bestStep2TestRoi = runBacktest(dataset, testDays, step1Params).roi;

    for (const includeConfInCoupons of [true, false]) {
      const params: InvestmentBacktestParams = {
        ...step1Params,
        includeConfInCoupons,
      };
      const trainResult = runBacktest(dataset, trainDays, params);
      const testResult = runBacktest(dataset, testDays, params);
      const v = verdict(testResult);

      gridSearchRows.push({
        step: 2,
        k: params.k,
        minCalibratedJointProbability: params.minCalibratedJointProbability,
        maxLegs: params.maxLegs,
        maxCombinedOdds: params.maxCombinedOdds,
        capMin: params.capMin,
        capMax: params.capMax,
        recencyWeighting: params.recencyWeighting,
        nLeagueMin: params.nLeagueMin,
        includeConf: includeConfInCoupons,
        trainCoupons: trainResult.totalCoupons,
        trainHitRate: trainResult.hitRate,
        trainRoi: trainResult.roi,
        testCoupons: testResult.totalCoupons,
        testHitRate: testResult.hitRate,
        testRoi: testResult.roi,
        testMaxDrawdown: testResult.maxDrawdown,
        verdict: v,
      });

      if (v !== 'FAIL' && testResult.roi > bestStep2TestRoi) {
        bestStep2Params = params;
        bestStep2TestRoi = testResult.roi;
      }
    }

    // ── Step 3 : test recency weighting ───────────────────────────────────────
    let bestFinalParams = bestStep2Params;
    let bestFinalTestRoi = bestStep2TestRoi;

    for (const recencyWeighting of ['flat', 'exponential_decay_14d'] as const) {
      const params: InvestmentBacktestParams = {
        ...bestStep2Params,
        recencyWeighting,
      };
      const testResult = runBacktest(dataset, testDays, params);
      if (testResult.roi > bestFinalTestRoi) {
        bestFinalParams = params;
        bestFinalTestRoi = testResult.roi;
      }
    }

    // ── Final evaluation ──────────────────────────────────────────────────────
    const finalTrainResult = runBacktest(dataset, trainDays, bestFinalParams);
    const finalTestResult = runBacktest(dataset, testDays, bestFinalParams);

    logger.info(
      {
        trainROI: finalTrainResult.roi.toFixed(3),
        testROI: finalTestResult.roi.toFixed(3),
        testHitRate: finalTestResult.hitRate.toFixed(3),
        testCoupons: finalTestResult.totalCoupons,
      },
      'Final result',
    );

    const correlationMatrix = computeCorrelationMatrix(dataset);
    const confByLeague = computeConfByLeague(dataset);

    const output: InvestmentBacktestOutput = {
      selectedParams: bestFinalParams,
      trainResult: finalTrainResult,
      testResult: finalTestResult,
      correlationMatrix,
      confByLeague,
      gridSearchRows,
      generatedAt: new Date().toISOString(),
    };

    await this.writeReports(output);

    return output;
  }

  private async writeReports(output: InvestmentBacktestOutput): Promise<void> {
    const reportsDir = path.join(process.cwd(), 'reports');
    await mkdir(reportsDir, { recursive: true });

    // Grid search CSV
    await writeFile(
      path.join(reportsDir, 'backtest-grid-search.csv'),
      toCsv(output.gridSearchRows as unknown as Record<string, unknown>[]),
    );

    // Correlation matrix CSV
    await writeFile(
      path.join(reportsDir, 'backtest-correlation-matrix.csv'),
      toCsv(
        Object.entries(output.correlationMatrix).map(([pair, factor]) => ({
          pair,
          correlationFactor: factor.toFixed(4),
        })),
      ),
    );

    // CONF by league CSV
    await writeFile(
      path.join(reportsDir, 'backtest-conf-by-league.csv'),
      toCsv(
        output.confByLeague.map((r) => ({
          ...r,
          hitRate: r.hitRate.toFixed(3),
        })) as unknown as Record<string, unknown>[],
      ),
    );

    // Selected params JSON
    const selectedParamsJson = {
      generatedAt: output.generatedAt,
      trainSplit: { start: '2023-08-01', end: TRAIN_END },
      testSplit: { start: TRAIN_END, end: TEST_END },
      trainResult: {
        totalCoupons: output.trainResult.totalCoupons,
        hitRate: output.trainResult.hitRate.toFixed(3),
        roi: output.trainResult.roi.toFixed(3),
        maxDrawdown: output.trainResult.maxDrawdown.toFixed(2),
        activeDays: output.trainResult.activeDays,
      },
      testResult: {
        totalCoupons: output.testResult.totalCoupons,
        hitRate: output.testResult.hitRate.toFixed(3),
        roi: output.testResult.roi.toFixed(3),
        maxDrawdown: output.testResult.maxDrawdown.toFixed(2),
        activeDays: output.testResult.activeDays,
        verdict: verdict(output.testResult),
      },
      params: output.selectedParams,
      correlationMatrix: output.correlationMatrix,
      notes: [
        'All hyperparams are outputs of the grid search — never modify without re-running the backtest.',
        'Re-run monthly or after any model/scoring/source change.',
      ],
    };

    await writeFile(
      path.join(reportsDir, 'backtest-selected-params.json'),
      JSON.stringify(selectedParamsJson, null, 2),
    );

    logger.info({ reportsDir }, 'Reports written');
  }
}
