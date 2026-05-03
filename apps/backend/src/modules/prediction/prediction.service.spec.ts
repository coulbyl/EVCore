import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { Market, PredictionChannel } from '@evcore/db';
import {
  buildPredictionCandidate,
  resolveActualPick,
  PredictionService,
} from './prediction.service';
import type {
  PredictionRepository,
  PredictionRow,
} from './prediction.repository';

// ── helpers ──────────────────────────────────────────────────────────────────

function d(v: number | string) {
  return new Decimal(v);
}

function makeProba(input: {
  home: number;
  draw: number;
  away: number;
  bttsYes?: number;
}) {
  const { home, draw, away, bttsYes = 0.5 } = input;
  return {
    home: d(home),
    draw: d(draw),
    away: d(away),
    bttsYes: d(bttsYes),
  };
}

function makeRow(
  channel: PredictionChannel,
  market: Market,
  pick: string,
): PredictionRow {
  return {
    id: 'row-1',
    fixtureId: 'fix-1',
    modelRunId: 'run-1',
    competition: 'PL',
    channel,
    market,
    pick,
    probability: d(0.6),
    correct: null,
    settledAt: null,
    createdAt: new Date(),
  };
}

// ── buildPredictionCandidate ──────────────────────────────────────────────────

describe('buildPredictionCandidate — CONF channel', () => {
  it('picks HOME when home probability is highest', () => {
    const result = buildPredictionCandidate(
      PredictionChannel.CONF,
      makeProba({ home: 0.55, draw: 0.25, away: 0.2 }),
    );
    expect(result.market).toBe(Market.ONE_X_TWO);
    expect(result.pick).toBe('HOME');
    expect(result.probability.toNumber()).toBe(0.55);
  });

  it('picks DRAW when draw probability is highest', () => {
    const result = buildPredictionCandidate(
      PredictionChannel.CONF,
      makeProba({ home: 0.3, draw: 0.45, away: 0.25 }),
    );
    expect(result.market).toBe(Market.ONE_X_TWO);
    expect(result.pick).toBe('DRAW');
    expect(result.probability.toNumber()).toBe(0.45);
  });

  it('picks AWAY when away probability is highest', () => {
    const result = buildPredictionCandidate(
      PredictionChannel.CONF,
      makeProba({ home: 0.25, draw: 0.3, away: 0.45 }),
    );
    expect(result.market).toBe(Market.ONE_X_TWO);
    expect(result.pick).toBe('AWAY');
    expect(result.probability.toNumber()).toBe(0.45);
  });

  it('picks HOME on home=draw tie (home checked first)', () => {
    const result = buildPredictionCandidate(
      PredictionChannel.CONF,
      makeProba({ home: 0.4, draw: 0.4, away: 0.2 }),
    );
    expect(result.pick).toBe('HOME');
    expect(result.probability.toNumber()).toBe(0.4);
  });

  it('picks DRAW on draw=away tie (draw checked before away)', () => {
    const result = buildPredictionCandidate(
      PredictionChannel.CONF,
      makeProba({ home: 0.2, draw: 0.4, away: 0.4 }),
    );
    expect(result.pick).toBe('DRAW');
    expect(result.probability.toNumber()).toBe(0.4);
  });
});

describe('buildPredictionCandidate — DRAW channel', () => {
  it('always returns market ONE_X_TWO, pick DRAW and draw probability', () => {
    const result = buildPredictionCandidate(
      PredictionChannel.DRAW,
      makeProba({ home: 0.55, draw: 0.28, away: 0.17 }),
    );
    expect(result.market).toBe(Market.ONE_X_TWO);
    expect(result.pick).toBe('DRAW');
    expect(result.probability.toNumber()).toBe(0.28);
  });

  it('uses draw probability regardless of which outcome is highest', () => {
    // draw is the smallest here — canal DRAW still tracks it
    const result = buildPredictionCandidate(
      PredictionChannel.DRAW,
      makeProba({ home: 0.65, draw: 0.1, away: 0.25 }),
    );
    expect(result.pick).toBe('DRAW');
    expect(result.probability.toNumber()).toBe(0.1);
  });
});

describe('buildPredictionCandidate — BTTS channel', () => {
  it('returns market BTTS, pick YES and bttsYes probability', () => {
    const result = buildPredictionCandidate(
      PredictionChannel.BTTS,
      makeProba({ home: 0.4, draw: 0.3, away: 0.3, bttsYes: 0.62 }),
    );
    expect(result.market).toBe(Market.BTTS);
    expect(result.pick).toBe('YES');
    expect(result.probability.toNumber()).toBe(0.62);
  });

  it('ignores 1X2 probabilities entirely', () => {
    const low = buildPredictionCandidate(
      PredictionChannel.BTTS,
      makeProba({ home: 0.8, draw: 0.1, away: 0.1, bttsYes: 0.45 }),
    );
    expect(low.probability.toNumber()).toBe(0.45);
    expect(low.pick).toBe('YES');
  });
});

// ── resolveActualPick ─────────────────────────────────────────────────────────

describe('resolveActualPick — ONE_X_TWO market', () => {
  it('returns HOME when home score is higher', () => {
    expect(resolveActualPick(Market.ONE_X_TWO, 2, 0)).toBe('HOME');
    expect(resolveActualPick(Market.ONE_X_TWO, 1, 0)).toBe('HOME');
  });

  it('returns AWAY when away score is higher', () => {
    expect(resolveActualPick(Market.ONE_X_TWO, 0, 1)).toBe('AWAY');
    expect(resolveActualPick(Market.ONE_X_TWO, 1, 3)).toBe('AWAY');
  });

  it('returns DRAW on level scores', () => {
    expect(resolveActualPick(Market.ONE_X_TWO, 1, 1)).toBe('DRAW');
    expect(resolveActualPick(Market.ONE_X_TWO, 0, 0)).toBe('DRAW');
    expect(resolveActualPick(Market.ONE_X_TWO, 2, 2)).toBe('DRAW');
  });
});

describe('resolveActualPick — BTTS market', () => {
  it('returns YES when both teams scored', () => {
    expect(resolveActualPick(Market.BTTS, 1, 1)).toBe('YES');
    expect(resolveActualPick(Market.BTTS, 2, 1)).toBe('YES');
    expect(resolveActualPick(Market.BTTS, 3, 2)).toBe('YES');
  });

  it('returns NO when home did not score', () => {
    expect(resolveActualPick(Market.BTTS, 0, 1)).toBe('NO');
    expect(resolveActualPick(Market.BTTS, 0, 3)).toBe('NO');
  });

  it('returns NO when away did not score', () => {
    expect(resolveActualPick(Market.BTTS, 1, 0)).toBe('NO');
    expect(resolveActualPick(Market.BTTS, 2, 0)).toBe('NO');
  });

  it('returns NO on 0-0', () => {
    expect(resolveActualPick(Market.BTTS, 0, 0)).toBe('NO');
  });
});

// ── PredictionService.createPredictions ──────────────────────────────────────

function makeRepoMock(): PredictionRepository {
  return {
    upsert: vi.fn().mockResolvedValue(undefined),
    deleteForFixtureChannel: vi.fn().mockResolvedValue(undefined),
    settleById: vi.fn().mockResolvedValue(undefined),
    findPendingForFixture: vi.fn().mockResolvedValue([]),
    findByDate: vi.fn().mockResolvedValue([]),
    findForStats: vi.fn().mockResolvedValue([]),
  } as unknown as PredictionRepository;
}

describe('PredictionService.createPredictions', () => {
  let repo: PredictionRepository;
  let service: PredictionService;

  beforeEach(() => {
    repo = makeRepoMock();
    service = new PredictionService(repo);
  });

  it('upserts CONF pick when league is enabled and probability is above threshold', async () => {
    // PL: CONF enabled at 0.55
    await service.createPredictions({
      fixtureId: 'fix-1',
      modelRunId: 'run-1',
      competition: 'PL',
      probabilities: makeProba({
        home: 0.6,
        draw: 0.25,
        away: 0.15,
        bttsYes: 0.45,
      }),
    });

    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: PredictionChannel.CONF,
        market: Market.ONE_X_TWO,
        pick: 'HOME',
      }),
    );
  });

  it('deletes CONF when probability is below threshold', async () => {
    // PL CONF threshold = 0.55; home=0.50 < threshold
    await service.createPredictions({
      fixtureId: 'fix-1',
      modelRunId: 'run-1',
      competition: 'PL',
      probabilities: makeProba({
        home: 0.5,
        draw: 0.3,
        away: 0.2,
        bttsYes: 0.45,
      }),
    });

    expect(repo.deleteForFixtureChannel).toHaveBeenCalledWith(
      'fix-1',
      PredictionChannel.CONF,
    );
  });

  it('deletes when channel is disabled even if probability is high', async () => {
    // PL DRAW is explicitly disabled
    await service.createPredictions({
      fixtureId: 'fix-1',
      modelRunId: 'run-1',
      competition: 'PL',
      probabilities: makeProba({
        home: 0.4,
        draw: 0.9,
        away: 0.1,
        bttsYes: 0.45,
      }),
    });

    expect(repo.deleteForFixtureChannel).toHaveBeenCalledWith(
      'fix-1',
      PredictionChannel.DRAW,
    );
  });

  it('upserts BTTS pick with correct market and pick=YES when above threshold', async () => {
    // PL: BTTS enabled at 0.55
    await service.createPredictions({
      fixtureId: 'fix-1',
      modelRunId: 'run-1',
      competition: 'PL',
      probabilities: makeProba({
        home: 0.4,
        draw: 0.3,
        away: 0.3,
        bttsYes: 0.6,
      }),
    });

    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: PredictionChannel.BTTS,
        market: Market.BTTS,
        pick: 'YES',
      }),
    );
  });

  it('deletes DRAW pick when the league keeps DRAW disabled despite a high draw probability', async () => {
    // POR: DRAW threshold exists but the channel stays disabled.
    await service.createPredictions({
      fixtureId: 'fix-2',
      modelRunId: 'run-2',
      competition: 'POR',
      probabilities: makeProba({
        home: 0.35,
        draw: 0.4,
        away: 0.25,
        bttsYes: 0.45,
      }),
    });

    expect(repo.deleteForFixtureChannel).toHaveBeenCalledWith(
      'fix-2',
      PredictionChannel.DRAW,
    );
  });

  it('processes all three channels independently in one call', async () => {
    // BL1: CONF enabled (0.5), DRAW no config (disabled), BTTS enabled (0.56)
    await service.createPredictions({
      fixtureId: 'fix-3',
      modelRunId: 'run-3',
      competition: 'BL1',
      probabilities: makeProba({
        home: 0.55,
        draw: 0.25,
        away: 0.2,
        bttsYes: 0.6,
      }),
    });

    const upsertCalls = vi
      .mocked(repo.upsert)
      .mock.calls.map(([arg]) => arg.channel);
    const deleteCalls = vi
      .mocked(repo.deleteForFixtureChannel)
      .mock.calls.map(([, channel]) => channel);

    expect(upsertCalls).toContain(PredictionChannel.CONF);
    expect(upsertCalls).toContain(PredictionChannel.BTTS);
    expect(deleteCalls).toContain(PredictionChannel.DRAW);
  });

  it('rounds probability to 4 decimal places on upsert', async () => {
    await service.createPredictions({
      fixtureId: 'fix-1',
      modelRunId: 'run-1',
      competition: 'PL',
      probabilities: makeProba({
        home: 0.666666,
        draw: 0.2,
        away: 0.13,
        bttsYes: 0.333333,
      }),
    });

    const upsertArg = vi
      .mocked(repo.upsert)
      .mock.calls.find(([arg]) => arg.channel === PredictionChannel.CONF)?.[0];

    expect(upsertArg?.probability.toString()).toBe('0.6667');
  });
});

// ── PredictionService.settlePredictions ──────────────────────────────────────

describe('PredictionService.settlePredictions', () => {
  let repo: PredictionRepository;
  let service: PredictionService;

  beforeEach(() => {
    repo = makeRepoMock();
    service = new PredictionService(repo);
  });

  it('returns { settled: 0 } when scores are null', async () => {
    const result = await service.settlePredictions('fix-1', null, null);
    expect(result).toEqual({ settled: 0 });
    expect(repo.findPendingForFixture).not.toHaveBeenCalled();
  });

  it('returns { settled: 0 } when no pending predictions exist', async () => {
    vi.mocked(repo.findPendingForFixture).mockResolvedValue([]);
    const result = await service.settlePredictions('fix-1', 2, 1);
    expect(result).toEqual({ settled: 0 });
  });

  it('settles CONF HOME prediction as correct on home win', async () => {
    vi.mocked(repo.findPendingForFixture).mockResolvedValue([
      makeRow(PredictionChannel.CONF, Market.ONE_X_TWO, 'HOME'),
    ]);

    const result = await service.settlePredictions('fix-1', 2, 0);

    expect(result).toEqual({ settled: 1 });
    expect(repo.settleById).toHaveBeenCalledWith('row-1', true);
  });

  it('settles CONF HOME prediction as incorrect on away win', async () => {
    vi.mocked(repo.findPendingForFixture).mockResolvedValue([
      makeRow(PredictionChannel.CONF, Market.ONE_X_TWO, 'HOME'),
    ]);

    await service.settlePredictions('fix-1', 0, 1);

    expect(repo.settleById).toHaveBeenCalledWith('row-1', false);
  });

  it('settles DRAW channel prediction as correct on level score', async () => {
    vi.mocked(repo.findPendingForFixture).mockResolvedValue([
      makeRow(PredictionChannel.DRAW, Market.ONE_X_TWO, 'DRAW'),
    ]);

    await service.settlePredictions('fix-1', 1, 1);

    expect(repo.settleById).toHaveBeenCalledWith('row-1', true);
  });

  it('settles DRAW channel prediction as incorrect on decisive result', async () => {
    vi.mocked(repo.findPendingForFixture).mockResolvedValue([
      makeRow(PredictionChannel.DRAW, Market.ONE_X_TWO, 'DRAW'),
    ]);

    await service.settlePredictions('fix-1', 2, 0);

    expect(repo.settleById).toHaveBeenCalledWith('row-1', false);
  });

  it('settles BTTS YES prediction as correct when both teams scored', async () => {
    vi.mocked(repo.findPendingForFixture).mockResolvedValue([
      makeRow(PredictionChannel.BTTS, Market.BTTS, 'YES'),
    ]);

    await service.settlePredictions('fix-1', 1, 1);

    expect(repo.settleById).toHaveBeenCalledWith('row-1', true);
  });

  it('settles BTTS YES prediction as incorrect when only one team scored', async () => {
    vi.mocked(repo.findPendingForFixture).mockResolvedValue([
      makeRow(PredictionChannel.BTTS, Market.BTTS, 'YES'),
    ]);

    await service.settlePredictions('fix-1', 1, 0);

    expect(repo.settleById).toHaveBeenCalledWith('row-1', false);
  });

  it('settles BTTS YES prediction as incorrect on 0-0', async () => {
    vi.mocked(repo.findPendingForFixture).mockResolvedValue([
      makeRow(PredictionChannel.BTTS, Market.BTTS, 'YES'),
    ]);

    await service.settlePredictions('fix-1', 0, 0);

    expect(repo.settleById).toHaveBeenCalledWith('row-1', false);
  });

  it('settles multiple pending predictions (CONF + BTTS) independently', async () => {
    const confRow = {
      ...makeRow(PredictionChannel.CONF, Market.ONE_X_TWO, 'HOME'),
      id: 'conf-row',
    };
    const bttsRow = {
      ...makeRow(PredictionChannel.BTTS, Market.BTTS, 'YES'),
      id: 'btts-row',
    };
    vi.mocked(repo.findPendingForFixture).mockResolvedValue([confRow, bttsRow]);

    // 2-1: HOME wins, BTTS YES
    const result = await service.settlePredictions('fix-1', 2, 1);

    expect(result).toEqual({ settled: 2 });
    expect(repo.settleById).toHaveBeenCalledWith('conf-row', true);
    expect(repo.settleById).toHaveBeenCalledWith('btts-row', true);
  });

  it('does not re-settle already settled predictions (findPendingForFixture filters them)', async () => {
    // Repo only returns pending (correct: null) predictions — already settled
    // rows are filtered at DB level. Verify we rely on that contract.
    vi.mocked(repo.findPendingForFixture).mockResolvedValue([]);

    const result = await service.settlePredictions('fix-1', 2, 1);

    expect(result).toEqual({ settled: 0 });
    expect(repo.settleById).not.toHaveBeenCalled();
  });
});
