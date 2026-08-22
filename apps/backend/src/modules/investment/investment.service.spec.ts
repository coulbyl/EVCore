import { describe, expect, it, vi } from 'vitest';
import type {
  ChannelDecisionChannelGroup,
  ChannelDecisionItem,
  ChannelDecisionService,
  ChannelSelectionItem,
} from '@modules/betting-engine/channel-decision.service';
import { IDENTITY_RELIABILITY } from '@modules/adjustment/channel-reliability';
import type {
  ChannelStats,
  ChannelStatsMap,
  InvestmentChannelStatsRepository,
} from './investment-channel-stats.repository';
import type {
  InvestmentCoherenceRepository,
  LambdaTotals,
} from './investment-coherence.repository';
import { INVESTMENT_LIMITS } from './investment.constants';
import { InvestmentService } from './investment.service';

function selection(
  overrides: Partial<ChannelSelectionItem> = {},
): ChannelSelectionItem {
  return {
    id: 'sel-1',
    market: 'ONE_X_TWO',
    pick: 'HOME',
    probability: 0.7,
    odds: 1.5,
    impliedProbability: 0.66,
    ev: 0.06,
    qualityScore: 0.04,
    rank: 1,
    result: null,
    ...overrides,
  };
}

function item(
  overrides: Partial<ChannelDecisionItem> = {},
): ChannelDecisionItem {
  return {
    id: 'decision-1',
    fixtureId: 'fx-1',
    fixtureStatus: 'SCHEDULED',
    modelRunId: 'run-1',
    competition: 'PL',
    competitionName: 'Premier League',
    country: 'England',
    homeTeam: 'Home FC',
    awayTeam: 'Away FC',
    homeLogo: null,
    awayLogo: null,
    homeNewCoach: false,
    awayNewCoach: false,
    kickoff: '18:00',
    scheduledAt: '2026-08-22T18:00:00.000Z',
    score: null,
    htScore: null,
    phase: 'ADVANCE',
    channel: 'VALUE',
    status: 'SELECTED',
    reasonCode: null,
    reasonDetails: null,
    calibrationAlert: false,
    selections: [selection()],
    ...overrides,
  };
}

function group(
  channel: ChannelDecisionChannelGroup['channel'],
  decisions: ChannelDecisionItem[],
): ChannelDecisionChannelGroup {
  return { channel, decisions };
}

function stats(overrides: Partial<ChannelStats> = {}): ChannelStats {
  return {
    reliability: IDENTITY_RELIABILITY,
    roiRaw: 0,
    roiShrunk: 0,
    roiWeight: 0,
    hitRate: 0.5,
    n: 1000,
    ...overrides,
  };
}

/** Un canal assumé : ROI shrinké strictement positif. */
const POSITIVE = stats({ roiShrunk: 0.0224, roiRaw: 0.0434 });
/** Un canal en observation : ROI shrinké négatif. */
const NEGATIVE = stats({ roiShrunk: -0.0463, roiRaw: -0.0463 });

function makeService(
  groups: ChannelDecisionChannelGroup[],
  channelStats: ChannelStatsMap = {},
  lambdaTotals: LambdaTotals = new Map(),
) {
  const channelDecisions = {
    listByChannel: vi.fn().mockResolvedValue(groups),
  } as unknown as ChannelDecisionService;
  const statsRepository = {
    compute: vi.fn().mockResolvedValue(channelStats),
  } as unknown as InvestmentChannelStatsRepository;
  const coherenceRepository = {
    findLambdaTotals: vi.fn().mockResolvedValue(lambdaTotals),
  } as unknown as InvestmentCoherenceRepository;
  return new InvestmentService(
    channelDecisions,
    statsRepository,
    coherenceRepository,
  );
}

// Un pick à cote 2.5 et proba brute 0.5 : edge = 0.5 - 0.4 = 0.10, pile au
// plafond, donc conservé (le garde-fou exclut au-delà, pas à égalité).
function safePick(overrides: Partial<ChannelSelectionItem> = {}) {
  return selection({ probability: 0.5, odds: 2.5, ...overrides });
}

describe('InvestmentService.listPicks — partition des vues', () => {
  it('assume les canaux à ROI shrinké positif et met les autres en observation', async () => {
    const groups = [
      group('DOUBLE_CHANCE', [
        item({
          fixtureId: 'fx-dc',
          channel: 'DOUBLE_CHANCE',
          selections: [safePick()],
        }),
      ]),
      group('GOALS', [
        item({
          fixtureId: 'fx-goals',
          channel: 'GOALS',
          selections: [safePick()],
        }),
      ]),
    ];
    const channelStats = { DOUBLE_CHANCE: POSITIVE, GOALS: NEGATIVE };

    const assumed = await makeService(groups, channelStats).listPicks({
      date: '2026-08-22',
      view: 'assumed',
    });
    const watch = await makeService(groups, channelStats).listPicks({
      date: '2026-08-22',
      view: 'watch',
    });

    expect(assumed.map((p) => p.fixtureId)).toEqual(['fx-dc']);
    expect(watch.map((p) => p.fixtureId)).toEqual(['fx-goals']);
  });

  it('assume DRAW seulement sur les ligues où il est mesuré', async () => {
    const groups = [
      group('DRAW', [
        item({
          fixtureId: 'fx-draw-i2',
          channel: 'DRAW',
          competition: 'I2',
          selections: [safePick()],
        }),
        item({
          fixtureId: 'fx-draw-pl',
          channel: 'DRAW',
          competition: 'PL',
          selections: [safePick()],
        }),
      ]),
    ];
    const channelStats = { DRAW: POSITIVE };

    const assumed = await makeService(groups, channelStats).listPicks({
      date: '2026-08-22',
      view: 'assumed',
    });
    const watch = await makeService(groups, channelStats).listPicks({
      date: '2026-08-22',
      view: 'watch',
    });

    expect(assumed.map((p) => p.fixtureId)).toEqual(['fx-draw-i2']);
    // Hors périmètre mesuré, le pick retombe en observation — pas écarté.
    expect(watch.map((p) => p.fixtureId)).toEqual(['fx-draw-pl']);
  });

  it('ne filtre par canal que les surfaces de revue', async () => {
    const groups = [
      group('GOALS', [
        item({
          fixtureId: 'fx-goals',
          channel: 'GOALS',
          selections: [safePick()],
        }),
      ]),
      group('BTTS', [
        item({
          fixtureId: 'fx-btts',
          channel: 'BTTS',
          selections: [safePick()],
        }),
      ]),
    ];
    const channelStats = { GOALS: NEGATIVE, BTTS: NEGATIVE };

    const picks = await makeService(groups, channelStats).listPicks({
      date: '2026-08-22',
      view: 'watch',
      channel: 'BTTS',
    });

    expect(picks.map((p) => p.fixtureId)).toEqual(['fx-btts']);
  });

  it('ne retient aucun canal quand tous les ROI shrinkés sont négatifs', async () => {
    const groups = [
      group('GOALS', [
        item({
          fixtureId: 'fx-goals',
          channel: 'GOALS',
          selections: [safePick()],
        }),
      ]),
    ];

    const assumed = await makeService(groups, { GOALS: NEGATIVE }).listPicks({
      date: '2026-08-22',
      view: 'assumed',
    });

    expect(assumed).toEqual([]);
  });
});

describe('InvestmentService.listPicks — garde-fous et vue « Écarté »', () => {
  async function excludedFor(
    decision: ChannelDecisionItem,
    lambdaTotals: LambdaTotals = new Map(),
  ) {
    const service = makeService(
      [group(decision.channel, [decision])],
      { [decision.channel]: NEGATIVE },
      lambdaTotals,
    );
    return service.listPicks({ date: '2026-08-22', view: 'excluded' });
  }

  it('écarte un edge revendiqué au-delà du plafond', async () => {
    // proba 0.7, cote 2.5 -> edge 0.30, très au-dessus de 0.10.
    const picks = await excludedFor(
      item({
        channel: 'GOALS',
        selections: [selection({ probability: 0.7, odds: 2.5 })],
      }),
    );

    expect(picks).toHaveLength(1);
    expect(picks[0]?.exclusionReason).toBe('EDGE_TOO_HIGH');
  });

  it('écarte une cote sous le plancher', async () => {
    const picks = await excludedFor(
      item({
        channel: 'GOALS',
        selections: [selection({ probability: 0.8, odds: 1.15 })],
      }),
    );

    expect(picks).toHaveLength(1);
    expect(picks[0]?.exclusionReason).toBe('ODDS_TOO_SHORT');
  });

  it('écarte un pick GOALS Under que le lambda du modèle contredit', async () => {
    const picks = await excludedFor(
      item({
        channel: 'GOALS',
        modelRunId: 'run-incoherent',
        selections: [safePick({ market: 'OVER_UNDER', pick: 'UNDER' })],
      }),
      new Map([['run-incoherent', 3.6]]), // lambda 3.6 > ligne 2.5
    );

    expect(picks).toHaveLength(1);
    expect(picks[0]?.exclusionReason).toBe('LAMBDA_INCOHERENT');
  });

  it('garde un pick GOALS Under que le lambda du modèle confirme', async () => {
    const service = makeService(
      [
        group('GOALS', [
          item({
            channel: 'GOALS',
            modelRunId: 'run-coherent',
            selections: [safePick({ market: 'OVER_UNDER', pick: 'UNDER' })],
          }),
        ]),
      ],
      { GOALS: NEGATIVE },
      new Map([['run-coherent', 2.1]]),
    );

    const picks = await service.listPicks({
      date: '2026-08-22',
      view: 'watch',
    });

    expect(picks).toHaveLength(1);
  });

  it("n'applique le contrôle de lambda qu'au canal GOALS", async () => {
    const service = makeService(
      [
        group('BTTS', [
          item({
            channel: 'BTTS',
            modelRunId: 'run-btts',
            selections: [safePick({ market: 'OVER_UNDER', pick: 'UNDER' })],
          }),
        ]),
      ],
      { BTTS: NEGATIVE },
      new Map([['run-btts', 3.6]]),
    );

    const picks = await service.listPicks({
      date: '2026-08-22',
      view: 'watch',
    });

    expect(picks).toHaveLength(1);
  });

  it("écarte tous les picks d'un match sur lequel AVOID a été sélectionné", async () => {
    const service = makeService(
      [
        group('GOALS', [
          item({
            fixtureId: 'fx-avoided',
            channel: 'GOALS',
            selections: [safePick()],
          }),
        ]),
        group('AVOID', [item({ fixtureId: 'fx-avoided', channel: 'AVOID' })]),
      ],
      { GOALS: NEGATIVE },
    );

    const excluded = await service.listPicks({
      date: '2026-08-22',
      view: 'excluded',
    });
    const watch = await makeService(
      [
        group('GOALS', [
          item({
            fixtureId: 'fx-avoided',
            channel: 'GOALS',
            selections: [safePick()],
          }),
        ]),
        group('AVOID', [item({ fixtureId: 'fx-avoided', channel: 'AVOID' })]),
      ],
      { GOALS: NEGATIVE },
    ).listPicks({ date: '2026-08-22', view: 'watch' });

    expect(excluded).toHaveLength(1);
    expect(excluded[0]?.exclusionReason).toBe('AVOID');
    expect(watch).toEqual([]);
  });

  it('reporte la raison de niveau match avant celle de niveau pick', async () => {
    // Le pick enfreint AUSSI le plafond d'edge, mais AVOID prime : la vue
    // répond à « pourquoi celui-là n'est pas dans la liste ».
    const service = makeService(
      [
        group('GOALS', [
          item({
            fixtureId: 'fx-both',
            channel: 'GOALS',
            selections: [selection({ probability: 0.9, odds: 2.5 })],
          }),
        ]),
        group('AVOID', [item({ fixtureId: 'fx-both', channel: 'AVOID' })]),
      ],
      { GOALS: NEGATIVE },
    );

    const picks = await service.listPicks({
      date: '2026-08-22',
      view: 'excluded',
    });

    expect(picks[0]?.exclusionReason).toBe('AVOID');
  });

  it('écarte un match dont le garde-fou de calibration a sauté', async () => {
    const picks = await excludedFor(
      item({
        channel: 'GOALS',
        calibrationAlert: true,
        selections: [safePick()],
      }),
    );

    expect(picks[0]?.exclusionReason).toBe('CALIBRATION_ALERT');
  });

  it('ignore une décision sans cote plutôt que de la présenter écartée', async () => {
    const picks = await excludedFor(
      item({ channel: 'GOALS', selections: [selection({ odds: null })] }),
    );

    expect(picks).toEqual([]);
  });
});

describe('InvestmentService.listPicks — probabilité et classement', () => {
  it('applique la courbe de fiabilité du canal à la probabilité affichée', async () => {
    // a = 0.5 aplatit la pente : sigmoid(0.5 * logit(0.7)) ≈ 0.606.
    const service = makeService(
      [
        group('GOALS', [
          item({
            channel: 'GOALS',
            selections: [selection({ probability: 0.7, odds: 1.9 })],
          }),
        ]),
      ],
      {
        GOALS: stats({
          roiShrunk: -0.05,
          reliability: { a: 0.5, b: 0, n: 500 },
        }),
      },
    );

    const picks = await service.listPicks({
      date: '2026-08-22',
      view: 'watch',
    });

    expect(picks[0]?.modelProbability).toBe(0.7);
    expect(picks[0]?.probability).toBeCloseTo(0.6044, 3);
  });

  it('laisse la probabilité intacte pour un canal sans mesure', async () => {
    const service = makeService([
      group('GOALS', [
        item({
          channel: 'GOALS',
          selections: [safePick({ probability: 0.6, odds: 1.9 })],
        }),
      ]),
    ]);

    const picks = await service.listPicks({
      date: '2026-08-22',
      view: 'watch',
    });

    expect(picks[0]?.probability).toBeCloseTo(0.6, 6);
  });

  it("classe par probabilité calibrée, puis affiche par heure de coup d'envoi", async () => {
    const service = makeService(
      [
        group('GOALS', [
          item({
            fixtureId: 'fx-late-strong',
            channel: 'GOALS',
            scheduledAt: '2026-08-22T20:00:00.000Z',
            selections: [safePick({ probability: 0.55, odds: 2 })],
          }),
          item({
            fixtureId: 'fx-early-weak',
            channel: 'GOALS',
            scheduledAt: '2026-08-22T15:00:00.000Z',
            selections: [safePick({ probability: 0.3, odds: 5 })],
          }),
        ]),
      ],
      { GOALS: NEGATIVE },
    );

    const picks = await service.listPicks({
      date: '2026-08-22',
      view: 'watch',
    });

    expect(picks.map((p) => p.fixtureId)).toEqual([
      'fx-early-weak',
      'fx-late-strong',
    ]);
  });

  it('plafonne la surface de mise, pas les surfaces de revue', async () => {
    const many = (channel: 'DOUBLE_CHANCE' | 'GOALS', count: number) =>
      Array.from({ length: count }, (_, i) =>
        item({
          fixtureId: `${channel}-${i}`,
          channel,
          selections: [safePick({ probability: 0.5 - i * 0.001, odds: 2.5 })],
        }),
      );
    const groups = [
      group('DOUBLE_CHANCE', many('DOUBLE_CHANCE', 40)),
      group('GOALS', many('GOALS', 40)),
    ];
    const channelStats = { DOUBLE_CHANCE: POSITIVE, GOALS: NEGATIVE };

    const assumed = await makeService(groups, channelStats).listPicks({
      date: '2026-08-22',
      view: 'assumed',
    });
    const watch = await makeService(groups, channelStats).listPicks({
      date: '2026-08-22',
      view: 'watch',
    });

    expect(assumed).toHaveLength(INVESTMENT_LIMITS.assumedMaxPicks);
    expect(watch).toHaveLength(40);
  });
});

describe('InvestmentService.listChannelPicks', () => {
  it("renvoie les picks d'un canal quelle que soit la vue où il tombe", async () => {
    const groups = [
      group('DRAW', [
        item({
          fixtureId: 'fx-draw-pl',
          channel: 'DRAW',
          competition: 'PL',
          selections: [safePick()],
        }),
      ]),
      group('GOALS', [
        item({
          fixtureId: 'fx-goals',
          channel: 'GOALS',
          selections: [safePick()],
        }),
      ]),
    ];

    const picks = await makeService(groups, {
      DRAW: POSITIVE,
      GOALS: NEGATIVE,
    }).listChannelPicks({ date: '2026-08-22', channel: 'DRAW' });

    // DRAW hors DRAW_STAKED_LEAGUES n'est pas dans « Ce qu'on assume », mais
    // un abonné au canal DRAW le reçoit quand même.
    expect(picks.map((p) => p.fixtureId)).toEqual(['fx-draw-pl']);
  });

  it('applique les mêmes garde-fous que les vues', async () => {
    const picks = await makeService(
      [
        group('DRAW', [
          item({
            channel: 'DRAW',
            competition: 'I2',
            selections: [selection({ probability: 0.9, odds: 2.5 })],
          }),
        ]),
      ],
      { DRAW: POSITIVE },
    ).listChannelPicks({ date: '2026-08-22', channel: 'DRAW' });

    expect(picks).toEqual([]);
  });
});
