/**
 * Backfill logic for ChannelDecision / ChannelSelection from the legacy
 * materialised data (Bet + Prediction), per ModelRun. Pure of any CLI/Nest
 * concern so it can be unit/e2e tested against a real Prisma client.
 *
 * Mapping (doc §13, étape 2):
 *   - EV     : Bet(source=MODEL, isSafeValue=false) → ChannelDecision(EV, SELECTED) + selection ;
 *              sinon ModelRun.decision=NO_BET        → ChannelDecision(EV, REJECTED, reasonCode=BACKFILL)
 *   - SAFE   : Bet(source=MODEL, isSafeValue=true)  → ChannelDecision(SAFE, SELECTED) + selection
 *   - DOMINANT / DRAW / BTTS : Prediction (CONF→DOMINANT, DRAW→DRAW, BTTS→BTTS)
 *              → ChannelDecision(SELECTED) + selection (result dérivé de `correct`)
 *
 * Idempotent: skip toute (modelRunId, channel) déjà présente (clé @@unique).
 */

import {
  BetSource,
  BetStatus,
  ChannelDecisionStatus,
  PredictionChannel,
  StrategyChannel,
  type Prisma,
  type PrismaClient,
} from '@evcore/db';

export type BackfillArgs = {
  from: string | null;
  to: string | null;
  limit: number | null;
  batchSize: number;
  dryRun: boolean;
};

export type BackfillStats = {
  runsProcessed: number;
  runsSkippedFully: number;
  evSelected: number;
  evRejected: number;
  safeSelected: number;
  predictionSelected: number;
  betsLinked: number;
};

type RunBet = {
  id: string;
  market: Prisma.BetGetPayload<true>['market'];
  pick: string;
  comboMarket: Prisma.BetGetPayload<true>['comboMarket'];
  comboPick: string | null;
  probEstimated: Prisma.Decimal;
  oddsSnapshot: Prisma.Decimal | null;
  ev: Prisma.Decimal;
  qualityScore: Prisma.Decimal | null;
  isSafeValue: boolean;
  status: BetStatus;
};

type RunPrediction = {
  channel: PredictionChannel;
  market: Prisma.PredictionGetPayload<true>['market'];
  pick: string;
  probability: Prisma.Decimal;
  correct: boolean | null;
  settledAt: Date | null;
};

type RunWork = {
  id: string;
  decision: Prisma.ModelRunGetPayload<true>['decision'];
  bets: RunBet[];
  predictions: RunPrediction[];
  existingChannels: Set<StrategyChannel>;
};

const PREDICTION_CHANNEL_MAP: Record<PredictionChannel, StrategyChannel> = {
  [PredictionChannel.CONF]: StrategyChannel.DOMINANT,
  [PredictionChannel.DRAW]: StrategyChannel.DRAW,
  [PredictionChannel.BTTS]: StrategyChannel.BTTS,
};

export function emptyStats(): BackfillStats {
  return {
    runsProcessed: 0,
    runsSkippedFully: 0,
    evSelected: 0,
    evRejected: 0,
    safeSelected: 0,
    predictionSelected: 0,
    betsLinked: 0,
  };
}

function mapPredictionResult(correct: boolean | null): BetStatus | null {
  if (correct === null) return null;
  return correct ? BetStatus.WON : BetStatus.LOST;
}

export function buildRunFilter(args: BackfillArgs): Prisma.ModelRunWhereInput {
  if (args.from === null && args.to === null) return {};
  return {
    fixture: {
      scheduledAt: {
        ...(args.from !== null
          ? { gte: new Date(`${args.from}T00:00:00.000Z`) }
          : {}),
        ...(args.to !== null
          ? { lte: new Date(`${args.to}T23:59:59.999Z`) }
          : {}),
      },
    },
  };
}

async function loadBatch(opts: {
  db: PrismaClient;
  where: Prisma.ModelRunWhereInput;
  skip: number;
  take: number;
}): Promise<RunWork[]> {
  const { db, where, skip, take } = opts;
  const runs = await db.modelRun.findMany({
    where,
    select: { id: true, decision: true },
    orderBy: { id: 'asc' },
    skip,
    take,
  });
  if (runs.length === 0) return [];

  const runIds = runs.map((r) => r.id);
  const [bets, predictions, existing] = await Promise.all([
    db.bet.findMany({
      where: { modelRunId: { in: runIds }, source: BetSource.MODEL },
      select: {
        id: true,
        modelRunId: true,
        market: true,
        pick: true,
        comboMarket: true,
        comboPick: true,
        probEstimated: true,
        oddsSnapshot: true,
        ev: true,
        qualityScore: true,
        isSafeValue: true,
        status: true,
      },
    }),
    db.prediction.findMany({
      where: { modelRunId: { in: runIds } },
      select: {
        modelRunId: true,
        channel: true,
        market: true,
        pick: true,
        probability: true,
        correct: true,
        settledAt: true,
      },
    }),
    db.channelDecision.findMany({
      where: { modelRunId: { in: runIds } },
      select: { modelRunId: true, channel: true },
    }),
  ]);

  const betsByRun = new Map<string, RunBet[]>();
  for (const b of bets) {
    const list = betsByRun.get(b.modelRunId) ?? [];
    list.push(b);
    betsByRun.set(b.modelRunId, list);
  }
  const predsByRun = new Map<string, RunPrediction[]>();
  for (const p of predictions) {
    const list = predsByRun.get(p.modelRunId) ?? [];
    list.push(p);
    predsByRun.set(p.modelRunId, list);
  }
  const existingByRun = new Map<string, Set<StrategyChannel>>();
  for (const d of existing) {
    const set = existingByRun.get(d.modelRunId) ?? new Set<StrategyChannel>();
    set.add(d.channel);
    existingByRun.set(d.modelRunId, set);
  }

  return runs.map((r) => ({
    id: r.id,
    decision: r.decision,
    bets: betsByRun.get(r.id) ?? [],
    predictions: predsByRun.get(r.id) ?? [],
    existingChannels: existingByRun.get(r.id) ?? new Set<StrategyChannel>(),
  }));
}

function betSelectionData(
  bet: RunBet,
  rank: number,
): Prisma.ChannelSelectionCreateWithoutChannelDecisionInput {
  return {
    market: bet.market,
    pick: bet.pick,
    comboMarket: bet.comboMarket,
    comboPick: bet.comboPick,
    probability: bet.probEstimated,
    odds: bet.oddsSnapshot,
    ev: bet.ev,
    qualityScore: bet.qualityScore,
    rank,
    result: bet.status,
  };
}

async function backfillBetChannel(opts: {
  tx: Prisma.TransactionClient;
  modelRunId: string;
  channel: StrategyChannel;
  bets: RunBet[];
}): Promise<number> {
  const { tx, modelRunId, channel, bets } = opts;
  const decision = await tx.channelDecision.create({
    data: { modelRunId, channel, status: ChannelDecisionStatus.SELECTED },
  });

  const ranked = [...bets].sort((a, b) => {
    const aq = a.qualityScore?.toNumber() ?? a.ev.toNumber();
    const bq = b.qualityScore?.toNumber() ?? b.ev.toNumber();
    return bq - aq;
  });

  let rank = 1;
  for (const bet of ranked) {
    const selection = await tx.channelSelection.create({
      data: { channelDecisionId: decision.id, ...betSelectionData(bet, rank) },
    });
    await tx.bet.update({
      where: { id: bet.id },
      data: { channelSelectionId: selection.id },
    });
    rank += 1;
  }
  return ranked.length;
}

async function backfillPredictionChannel(opts: {
  tx: Prisma.TransactionClient;
  modelRunId: string;
  prediction: RunPrediction;
}): Promise<void> {
  const { tx, modelRunId, prediction } = opts;
  const channel = PREDICTION_CHANNEL_MAP[prediction.channel];
  await tx.channelDecision.create({
    data: {
      modelRunId,
      channel,
      status: ChannelDecisionStatus.SELECTED,
      selections: {
        create: [
          {
            market: prediction.market,
            pick: prediction.pick,
            probability: prediction.probability,
            rank: 1,
            result: mapPredictionResult(prediction.correct),
            settledAt: prediction.settledAt,
          },
        ],
      },
    },
  });
}

async function processRun(opts: {
  db: PrismaClient;
  run: RunWork;
  stats: BackfillStats;
}): Promise<void> {
  const { db, run, stats } = opts;
  const evBets = run.bets.filter((b) => !b.isSafeValue);
  const safeBets = run.bets.filter((b) => b.isSafeValue);

  const evDone = run.existingChannels.has(StrategyChannel.EV);
  const safeDone = run.existingChannels.has(StrategyChannel.SAFE);
  const pendingPredictions = run.predictions.filter(
    (p) => !run.existingChannels.has(PREDICTION_CHANNEL_MAP[p.channel]),
  );

  const evToWrite = !evDone && (evBets.length > 0 || run.decision === 'NO_BET');
  const safeToWrite = !safeDone && safeBets.length > 0;

  if (!evToWrite && !safeToWrite && pendingPredictions.length === 0) {
    stats.runsSkippedFully += 1;
    return;
  }

  await db.$transaction(async (tx) => {
    if (evToWrite) {
      if (evBets.length > 0) {
        const linked = await backfillBetChannel({
          tx,
          modelRunId: run.id,
          channel: StrategyChannel.EV,
          bets: evBets,
        });
        stats.evSelected += 1;
        stats.betsLinked += linked;
      } else {
        await tx.channelDecision.create({
          data: {
            modelRunId: run.id,
            channel: StrategyChannel.EV,
            status: ChannelDecisionStatus.REJECTED,
            reasonCode: 'BACKFILL',
          },
        });
        stats.evRejected += 1;
      }
    }

    if (safeToWrite) {
      const linked = await backfillBetChannel({
        tx,
        modelRunId: run.id,
        channel: StrategyChannel.SAFE,
        bets: safeBets,
      });
      stats.safeSelected += 1;
      stats.betsLinked += linked;
    }

    for (const prediction of pendingPredictions) {
      await backfillPredictionChannel({ tx, modelRunId: run.id, prediction });
      stats.predictionSelected += 1;
    }
  });

  stats.runsProcessed += 1;
}

function countDryRun(run: RunWork, stats: BackfillStats): void {
  const evBets = run.bets.filter((b) => !b.isSafeValue);
  const safeBets = run.bets.filter((b) => b.isSafeValue);

  if (!run.existingChannels.has(StrategyChannel.EV)) {
    if (evBets.length > 0) {
      stats.evSelected += 1;
      stats.betsLinked += evBets.length;
    } else if (run.decision === 'NO_BET') {
      stats.evRejected += 1;
    }
  }
  if (!run.existingChannels.has(StrategyChannel.SAFE) && safeBets.length > 0) {
    stats.safeSelected += 1;
    stats.betsLinked += safeBets.length;
  }
  for (const p of run.predictions) {
    if (!run.existingChannels.has(PREDICTION_CHANNEL_MAP[p.channel])) {
      stats.predictionSelected += 1;
    }
  }
}

export async function runBackfill(opts: {
  db: PrismaClient;
  args: BackfillArgs;
  onProgress?: (processed: number, target: number) => void;
}): Promise<BackfillStats> {
  const { db, args, onProgress } = opts;
  const where = buildRunFilter(args);

  const total = await db.modelRun.count({ where });
  const target = args.limit !== null ? Math.min(total, args.limit) : total;
  const stats = emptyStats();

  let processed = 0;
  for (let skip = 0; skip < target; skip += args.batchSize) {
    const take = Math.min(args.batchSize, target - skip);
    const batch = await loadBatch({ db, where, skip, take });
    if (batch.length === 0) break;

    for (const run of batch) {
      if (args.dryRun) countDryRun(run, stats);
      else await processRun({ db, run, stats });
    }

    processed += batch.length;
    onProgress?.(processed, target);
  }

  return stats;
}
