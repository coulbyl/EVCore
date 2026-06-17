/**
 * Verification gate for the channel-decision backfill (doc §13, étape 3).
 * Read-only: compares the legacy representation (Bet + Prediction) to the new
 * one (ChannelSelection) and returns a pass/fail report. Must be green BEFORE
 * any legacy DROP (Étape 6). On failure, nothing is dropped.
 *
 * Checks:
 *   1. count parity      : #ChannelSelection == #Bet(MODEL) + #Prediction
 *   2. linkage           : every Bet(MODEL) has a channelSelectionId
 *   3. settled parity    : per channel, WON/LOST counts match legacy
 *                          (EV/SAFE ← Bet.status ; DOMINANT/DRAW/BTTS ← Prediction.correct)
 */

import {
  BetSource,
  BetStatus,
  PredictionChannel,
  StrategyChannel,
  type PrismaClient,
} from '@evcore/db';

export type VerificationCheck = {
  name: string;
  ok: boolean;
  details: Record<string, number | boolean | string>;
};

export type VerificationReport = {
  ok: boolean;
  checks: VerificationCheck[];
};

type SettledCounts = { won: number; lost: number };

async function newSettled(
  db: PrismaClient,
  channel: StrategyChannel,
): Promise<SettledCounts> {
  const [won, lost] = await Promise.all([
    db.channelSelection.count({
      where: { channelDecision: { channel }, result: BetStatus.WON },
    }),
    db.channelSelection.count({
      where: { channelDecision: { channel }, result: BetStatus.LOST },
    }),
  ]);
  return { won, lost };
}

async function legacyBetSettled(
  db: PrismaClient,
  isSafeValue: boolean,
): Promise<SettledCounts> {
  const where = { source: BetSource.MODEL, isSafeValue };
  const [won, lost] = await Promise.all([
    db.bet.count({ where: { ...where, status: BetStatus.WON } }),
    db.bet.count({ where: { ...where, status: BetStatus.LOST } }),
  ]);
  return { won, lost };
}

async function legacyPredictionSettled(
  db: PrismaClient,
  channel: PredictionChannel,
): Promise<SettledCounts> {
  const [won, lost] = await Promise.all([
    db.prediction.count({ where: { channel, correct: true } }),
    db.prediction.count({ where: { channel, correct: false } }),
  ]);
  return { won, lost };
}

function settledCheck(
  name: string,
  legacy: SettledCounts,
  next: SettledCounts,
): VerificationCheck {
  const ok = legacy.won === next.won && legacy.lost === next.lost;
  return {
    name,
    ok,
    details: {
      legacyWon: legacy.won,
      newWon: next.won,
      legacyLost: legacy.lost,
      newLost: next.lost,
    },
  };
}

export async function verifyBackfill(
  db: PrismaClient,
): Promise<VerificationReport> {
  const checks: VerificationCheck[] = [];

  // 1. count parity
  const [selectionCount, modelBetCount, predictionCount] = await Promise.all([
    db.channelSelection.count(),
    db.bet.count({ where: { source: BetSource.MODEL } }),
    db.prediction.count(),
  ]);
  const expectedSelections = modelBetCount + predictionCount;
  checks.push({
    name: 'count_parity',
    ok: selectionCount === expectedSelections,
    details: {
      selectionCount,
      modelBetCount,
      predictionCount,
      expectedSelections,
    },
  });

  // 2. linkage completeness
  const unlinkedModelBets = await db.bet.count({
    where: { source: BetSource.MODEL, channelSelectionId: null },
  });
  checks.push({
    name: 'all_model_bets_linked',
    ok: unlinkedModelBets === 0,
    details: { unlinkedModelBets },
  });

  // 3. settled parity per channel
  const settledPairs: Array<[string, SettledCounts, SettledCounts]> =
    await Promise.all([
      legacyBetSettled(db, false).then((l) =>
        newSettled(db, StrategyChannel.EV).then(
          (n) =>
            ['settled_parity_EV', l, n] as [
              string,
              SettledCounts,
              SettledCounts,
            ],
        ),
      ),
      legacyBetSettled(db, true).then((l) =>
        newSettled(db, StrategyChannel.SAFE).then(
          (n) =>
            ['settled_parity_SAFE', l, n] as [
              string,
              SettledCounts,
              SettledCounts,
            ],
        ),
      ),
      legacyPredictionSettled(db, PredictionChannel.CONF).then((l) =>
        newSettled(db, StrategyChannel.DOMINANT).then(
          (n) =>
            ['settled_parity_DOMINANT', l, n] as [
              string,
              SettledCounts,
              SettledCounts,
            ],
        ),
      ),
      legacyPredictionSettled(db, PredictionChannel.DRAW).then((l) =>
        newSettled(db, StrategyChannel.DRAW).then(
          (n) =>
            ['settled_parity_DRAW', l, n] as [
              string,
              SettledCounts,
              SettledCounts,
            ],
        ),
      ),
      legacyPredictionSettled(db, PredictionChannel.BTTS).then((l) =>
        newSettled(db, StrategyChannel.BTTS).then(
          (n) =>
            ['settled_parity_BTTS', l, n] as [
              string,
              SettledCounts,
              SettledCounts,
            ],
        ),
      ),
    ]);

  for (const [name, legacy, next] of settledPairs) {
    checks.push(settledCheck(name, legacy, next));
  }

  return { ok: checks.every((c) => c.ok), checks };
}
