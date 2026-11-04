import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@evcore/db';
import type {
  MarketPriceRow,
  PlayableOddsRepository,
  PlayableQuote,
} from '@modules/betting-engine/pricing/playable-odds.repository';
import type { MatchFacts } from '@evcore/analysis-core';
import type { MatchFactsRepository } from '@modules/fixture-events/match-facts.repository';
import type { PlayerSquadRepository } from '@modules/fixture-events/player-squad.repository';
import type {
  LegFactRepository,
  TeamMatchRow,
} from '@modules/coupon/leg-fact/leg-fact.repository';
import type {
  AiOpinionRow,
  MatchesRepository,
  ReadingCandidateRow,
  SheetHeaderRow,
} from './matches.repository';
import type {
  FixtureEventRepository,
  SheetEventRow,
} from '@modules/fixture-events/fixture-event.repository';
import { MatchSheetService, setAsideReasonOf } from './match-sheet.service';
import { speechOf } from './matches-reading';

const NOW = new Date('2026-10-30T15:00:00.000Z');
const FX = '0190a000-0000-7000-8000-000000000001';

function header(overrides: Partial<SheetHeaderRow> = {}): SheetHeaderRow {
  return {
    fixtureId: FX,
    scheduledAt: new Date('2026-10-30T19:00:00.000Z'),
    status: 'SCHEDULED',
    homeScore: null,
    awayScore: null,
    homeHalfTimeScore: null,
    liveStatus: null,
    liveElapsed: null,
    awayHalfTimeScore: null,
    homeTeamId: 'ars',
    awayTeamId: 'che',
    homeName: 'Arsenal',
    homeShortName: 'ARS',
    homeLogoUrl: null,
    awayName: 'Chelsea',
    awayShortName: 'CHE',
    awayLogoUrl: null,
    competitionCode: 'PL',
    competitionName: 'Premier League',
    leagueRank: 0,
    meetings: null,
    ...overrides,
  };
}

const candidate = (
  overrides: Partial<ReadingCandidateRow> = {},
): ReadingCandidateRow => ({
  fixtureId: FX,
  avoided: false,
  channel: 'DOMINANT',
  market: 'ONE_X_TWO',
  pick: 'HOME',
  probability: new Prisma.Decimal('0.7000'),
  result: null,
  ...overrides,
});

function quote(
  key: string,
  price: { odds: number; fair: number },
): [string, PlayableQuote] {
  const [market = '', pick = ''] = key.split('/');
  const { odds, fair } = price;
  return [
    `${FX}|${market}|${pick}`,
    {
      fixtureId: FX,
      market,
      pick,
      operatorOdds: odds,
      operatorBookmaker: '1xBet',
      operatorMargin: 0.07,
      operatorFairProbability: fair,
      lowestOdds: odds,
      lowestBookmaker: '1xBet',
    },
  ];
}

const QUOTES: [string, PlayableQuote][] = [
  quote('ONE_X_TWO/HOME', { odds: 1.65, fair: 0.58 }),
  quote('ONE_X_TWO/DRAW', { odds: 3.4, fair: 0.27 }),
  quote('ONE_X_TWO/AWAY', { odds: 5.2, fair: 0.15 }),
  quote('OVER_UNDER/OVER', { odds: 1.8, fair: 0.53 }),
  quote('OVER_UNDER/UNDER', { odds: 1.95, fair: 0.47 }),
  quote('BTTS/YES', { odds: 1.7, fair: 0.56 }),
];

/** `count` home wins of Arsenal, one a week before kick-off. */
function homeWins(count: number): TeamMatchRow[] {
  return Array.from({ length: count }, (_, i) => ({
    teamId: 'ars',
    atHome: true,
    scheduledAt: new Date(
      Date.parse('2026-10-26T19:00:00.000Z') - i * 7 * 86_400_000,
    ),
    goalsFor: 2,
    goalsAgainst: 0,
    halfTimeFor: 1,
    halfTimeAgainst: 0,
    corners: null,
  }));
}

function harness(input: {
  header?: SheetHeaderRow | null;
  candidates?: ReadingCandidateRow[];
  ai?: AiOpinionRow[];
  history?: TeamMatchRow[];
  quotes?: [string, PlayableQuote][];
  reasons?: string[];
  events?: SheetEventRow[];
  marketRows?: MarketPriceRow[];
  playerNames?: Map<number, string>;
  facts?: MatchFacts | null;
}) {
  const repository = {
    findSheetHeader: vi
      .fn()
      .mockResolvedValue(input.header === undefined ? header() : input.header),
    findReadingCandidates: vi
      .fn()
      .mockResolvedValue(input.candidates ?? [candidate()]),
    findAiOpinions: vi.fn().mockResolvedValue(input.ai ?? []),
    findRejectionReasons: vi.fn().mockResolvedValue(input.reasons ?? []),
  } as unknown as MatchesRepository;
  const playableOdds = {
    findPlayableQuotes: vi
      .fn()
      .mockResolvedValue(new Map(input.quotes ?? QUOTES)),
    findMarketPrices: vi.fn().mockResolvedValue(input.marketRows ?? []),
  } as unknown as PlayableOddsRepository;
  const history = {
    findTeamHistories: vi.fn().mockResolvedValue(input.history ?? homeWins(6)),
  } as unknown as LegFactRepository;
  const fixtureEvents = {
    findSheetEvents: vi.fn().mockResolvedValue(input.events ?? []),
  } as unknown as FixtureEventRepository;
  const matchFacts = {
    findFacts: vi
      .fn()
      .mockResolvedValue(
        new Map(input.facts ? [[FX, input.facts] as const] : []),
      ),
  } as unknown as MatchFactsRepository;
  const squads = {
    findDisplayNames: vi
      .fn()
      .mockResolvedValue(input.playerNames ?? new Map<number, string>()),
  } as unknown as PlayerSquadRepository;
  return {
    service: new MatchSheetService(
      repository,
      playableOdds,
      history,
      fixtureEvents,
      matchFacts,
      squads,
    ),
    matchFacts,
    squads,
    fixtureEvents,
    repository,
    playableOdds,
    history,
  };
}

describe('MatchSheetService', () => {
  it('answers 404 for an unknown match', async () => {
    const { service } = harness({ header: null });
    await expect(service.getSheet(FX, NOW)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reads the teams before kick-off and every price in one call', async () => {
    const { service, history, playableOdds } = harness({});
    await service.getSheet(FX, NOW);
    expect(history.findTeamHistories).toHaveBeenCalledWith(
      expect.objectContaining({
        teamIds: ['ars', 'che'],
        before: new Date('2026-10-30T19:00:00.000Z'),
      }),
    );
    expect(playableOdds.findPlayableQuotes).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(playableOdds.findPlayableQuotes).mock.calls[0]?.[1],
    ).toEqual({ operatorOnly: true });
  });

  it('our reading carries its 1xBet price, its chance and its fact', async () => {
    const sheet = await harness({}).service.getSheet(FX, NOW);
    expect(sheet.reading).toEqual({
      market: 'ONE_X_TWO',
      pick: 'HOME',
      line: null,
      player: null,
      addable: true,
      odds: 1.65,
      chance: 0.7,
      result: null,
      fact: 'Arsenal a gagné ses 6 derniers matchs à domicile',
    });
    expect(sheet).not.toHaveProperty('operatorMargin');
  });

  it("the AI's pick is one more pick, with the market's chance", async () => {
    const sheet = await harness({
      ai: [
        {
          status: 'SELECTED',
          voice: null,
          decidedAt: new Date('2026-10-31T13:41:00Z'),
          text: 'Chelsea n’a perdu qu’une fois en huit déplacements. Le reste du texte.',
          market: 'ONE_X_TWO',
          pick: 'DRAW',
          result: null,
        },
      ],
    }).service.getSheet(FX, NOW);
    expect(sheet.ai).toEqual({
      market: 'ONE_X_TWO',
      pick: 'DRAW',
      line: null,
      player: null,
      addable: true,
      odds: 3.4,
      chance: 0.27,
      result: null,
      sameAsReading: false,
      speech:
        'Chelsea n’a perdu qu’une fois en huit déplacements. Le reste du texte.',
      decidedAt: '2026-10-31T13:41:00.000Z',
    });
    // Neither the reading nor the AI's pick come back in « Autres paris ».
    expect(sheet.otherPicks.map((p) => `${p.market}/${p.pick}`)).toEqual([
      'ONE_X_TWO/AWAY',
      'OVER_UNDER/OVER',
      'OVER_UNDER/UNDER',
      'BTTS/YES',
    ]);
  });

  it('says when the AI played our pick, with our chance, and nothing when it did not play', async () => {
    const same = await harness({
      ai: [
        {
          status: 'SELECTED',
          voice: null,
          decidedAt: new Date('2026-10-31T13:41:00Z'),
          text: null,
          market: 'ONE_X_TWO',
          pick: 'HOME',
          result: null,
        },
      ],
    }).service.getSheet(FX, NOW);
    expect(same.ai).toMatchObject({ sameAsReading: true, chance: 0.7 });
    const silent = await harness({
      ai: [
        {
          status: 'REJECTED',
          voice: null,
          decidedAt: new Date('2026-10-31T13:41:00Z'),
          text: 'x',
          market: null,
          pick: null,
          result: null,
        },
      ],
    }).service.getSheet(FX, NOW);
    expect(silent.ai).toBeNull();
    // A pre-v6 no-play narrates its rules: nothing shown.
    expect(silent.aiAbstention).toBeNull();
  });

  it("shows the AI's no-bet opinion when it speaks of the match (v6)", async () => {
    const sheet = await harness({
      ai: [
        {
          status: 'REJECTED',
          voice: 'match',
          decidedAt: new Date('2026-11-03T09:10:00Z'),
          text: ' Levadia domine, mais le favori est trop cher à ce prix. ',
          market: null,
          pick: null,
          result: null,
        },
      ],
    }).service.getSheet(FX, NOW);
    expect(sheet.ai).toBeNull();
    expect(sheet.aiAbstention).toEqual({
      speech: 'Levadia domine, mais le favori est trop cher à ce prix.',
      decidedAt: '2026-11-03T09:10:00.000Z',
    });
  });

  it('form: five squares oldest first, and the days of rest', async () => {
    const history = [
      ...homeWins(4),
      {
        teamId: 'ars',
        atHome: false,
        scheduledAt: new Date('2026-10-22T19:00:00.000Z'),
        goalsFor: 0,
        goalsAgainst: 1,
        halfTimeFor: 0,
        halfTimeAgainst: 0,
        corners: null,
      },
      {
        teamId: 'ars',
        atHome: false,
        scheduledAt: new Date('2026-09-01T19:00:00.000Z'),
        goalsFor: 1,
        goalsAgainst: 1,
        halfTimeFor: 0,
        halfTimeAgainst: 0,
        corners: null,
      },
    ];
    const sheet = await harness({ history }).service.getSheet(FX, NOW);
    // 26/10 W, 22/10 L, 19/10 W, 12/10 W, 05/10 W — then the 01/09 draw drops.
    expect(sheet.form.home).toEqual({
      last: ['won', 'won', 'won', 'lost', 'won'],
      restDays: 4,
    });
    expect(sheet.form.away).toEqual({ last: [], restDays: null });
  });

  it('head-to-head: a side that won half of the meetings, with its elision', async () => {
    const meetings = (scores: [number, number][]) =>
      scores.map(([homeGoals, awayGoals]) => ({ homeGoals, awayGoals }));
    const said = async (m: SheetHeaderRow['meetings'], away = 'Chelsea') =>
      (
        await harness({
          header: header({ meetings: m, awayName: away }),
        }).service.getSheet(FX, NOW)
      ).headToHead;
    expect(
      await said(
        meetings([
          [2, 0],
          [1, 0],
          [0, 0],
          [3, 1],
          [0, 2],
          [1, 1],
        ]),
      ),
    ).toBe("3 victoires d'Arsenal sur les 6 derniers");
    expect(
      await said(
        meetings([
          [0, 2],
          [0, 1],
          [1, 1],
        ]),
        'Everton',
      ),
    ).toBe("2 victoires d'Everton sur les 3 derniers");
    expect(
      await said(
        meetings([
          [1, 1],
          [0, 0],
          [2, 1],
          [2, 2],
        ]),
      ),
    ).toBe('3 nuls sur les 4 derniers face-à-face');
    expect(
      await said(
        meetings([
          [2, 0],
          [0, 1],
        ]),
      ),
    ).toBeNull();
  });

  it('a finished match: « Autres paris » says what landed', async () => {
    const sheet = await harness({
      header: header({ status: 'FINISHED', homeScore: 2, awayScore: 1 }),
      candidates: [candidate({ result: 'WON' })],
    }).service.getSheet(FX, NOW);
    expect(sheet.state).toBe('finished');
    expect(sheet.reading?.result).toBe('won');
    expect(
      Object.fromEntries(
        sheet.otherPicks.map((p) => [`${p.market}/${p.pick}`, p.result]),
      ),
    ).toEqual({
      'ONE_X_TWO/DRAW': 'lost',
      'ONE_X_TWO/AWAY': 'lost',
      'OVER_UNDER/OVER': 'won',
      'OVER_UNDER/UNDER': 'lost',
      'BTTS/YES': 'won',
    });
  });

  it('the best chance is the reading; the 1X2 joins « Autres paris »', async () => {
    const sheet = await harness({
      candidates: [
        candidate(),
        candidate({
          channel: 'GOALS',
          market: 'OVER_UNDER',
          pick: 'OVER_1_5',
          probability: new Prisma.Decimal('0.85'),
        }),
      ],
      quotes: [
        ...QUOTES,
        quote('OVER_UNDER/OVER_1_5', { odds: 1.25, fair: 0.76 }),
      ],
    }).service.getSheet(FX, NOW);
    // « Plus de 1,5 but » is 15 points above the home win, beyond the
    // speaking tolerance: it is the reading, and
    // the 1X2 home win joins « Autres paris » with the main lines.
    expect(sheet.reading?.pick).toBe('OVER_1_5');
    expect(sheet.otherPicks.at(0)).toEqual({
      market: 'ONE_X_TWO',
      pick: 'HOME',
      line: null,
      player: null,
      addable: true,
      odds: 1.65,
      chance: 0.58,
      result: null,
    });
  });
});

describe('MatchSheetService, the new markets in « Autres paris »', () => {
  const at = new Date('2026-10-30T18:00:00.000Z');
  const corners = (pick: string, odds: number): MarketPriceRow => ({
    market: 'CORNERS_1X2',
    pick,
    line: null,
    bookmaker: '1xBet',
    odds,
    snapshotAt: at,
  });
  const rows: MarketPriceRow[] = [
    corners('HOME', 1.6),
    corners('DRAW', 8),
    corners('AWAY', 2.6),
    {
      market: 'GOAL_SCORER_ANYTIME',
      pick: 'P9',
      line: null,
      bookmaker: 'Bet365',
      odds: 2.1,
      snapshotAt: at,
    },
  ];

  it('follow the main lines with their price, never addable, names read once', async () => {
    const { service, squads, matchFacts } = harness({
      marketRows: rows,
      playerNames: new Map([[9, 'Bukayo Saka']]),
    });
    const sheet = await service.getSheet(FX, NOW);
    const added = sheet.otherPicks.slice(-4);
    expect(added.map((p) => `${p.market}/${p.pick}`)).toEqual([
      'CORNERS_1X2/HOME',
      'CORNERS_1X2/DRAW',
      'CORNERS_1X2/AWAY',
      'GOAL_SCORER_ANYTIME/P9',
    ]);
    expect(added[0]).toMatchObject({ odds: 1.6, result: null, addable: false });
    expect(added[3]).toEqual({
      market: 'GOAL_SCORER_ANYTIME',
      pick: 'P9',
      line: null,
      player: 'Bukayo Saka',
      odds: 2.1,
      chance: null,
      result: null,
      addable: false,
    });
    expect(squads.findDisplayNames).toHaveBeenCalledWith([9]);
    // Before the end, no facts are read.
    expect(matchFacts.findFacts).not.toHaveBeenCalled();
  });

  it('after the end: settled on the facts, unsettled without them', async () => {
    const finished = header({ status: 'FINISHED', homeScore: 1, awayScore: 0 });
    const results = async (facts: MatchFacts | null) =>
      (
        await harness({
          header: finished,
          marketRows: rows,
          playerNames: new Map([[9, 'Bukayo Saka']]),
          facts,
        }).service.getSheet(FX, NOW)
      ).otherPicks
        .slice(-4)
        .map((p) => p.result);
    expect(await results(null)).toEqual([null, null, null, null]);
    // Corners went to Chelsea; the goal's event is missing, the scorer unknown.
    expect(
      await results({
        score: { home: 1, away: 0 },
        teams: {
          home: {
            corners: 3,
            shotsTotal: null,
            shotsOn: null,
            yellowCards: null,
            redCards: null,
          },
          away: {
            corners: 7,
            shotsTotal: null,
            shotsOn: null,
            yellowCards: null,
            redCards: null,
          },
        },
        events: [],
        lineups: [{ side: 'home', playerExternalId: 9, starter: true }],
        playerStats: null,
      }),
    ).toEqual(['lost', 'lost', 'won', null]);
  });
});

describe('setAsideReasonOf (06 § 4–5)', () => {
  const quotes = (odds: number) =>
    new Map([quote('ONE_X_TWO/HOME', { odds, fair: 0.7 })]);

  it('AVOID first: the model and the market disagree too much', () => {
    expect(
      setAsideReasonOf({
        candidates: [candidate({ avoided: true })],
        quotes: quotes(1.6),
        rejectionReasons: ['market_suspended'],
      }),
    ).toBe('divergence');
  });

  it('every pick priced under the floor at 1xBet: the odds are too low', () => {
    expect(
      setAsideReasonOf({
        candidates: [candidate()],
        quotes: quotes(1.12),
        rejectionReasons: [],
      }),
    ).toBe('low_odds');
  });

  it('a suspended market, otherwise no chance sure enough', () => {
    const none = {
      candidates: [candidate({ market: null, pick: null })],
      quotes: new Map(),
    };
    expect(
      setAsideReasonOf({ ...none, rejectionReasons: ['market_suspended'] }),
    ).toBe('suspended');
    expect(
      setAsideReasonOf({ ...none, rejectionReasons: ['below_threshold'] }),
    ).toBe('not_sure');
  });
});

describe('speechOf', () => {
  it('keeps the whole text, figures and all (31/10)', () => {
    const text =
      'Le Bayer Leverkusen affiche une forme à domicile exceptionnelle (62 % de réussite, 100 % de victoires à domicile) et un xG supérieur à celui de Stuttgart. Ces indicateurs laissent penser que les Leverkusen sont très susceptibles de l’emporter.';
    expect(speechOf(text)).toBe(text);
    expect(speechOf(`  ${text}  `)).toBe(text);
  });

  it('says nothing for an empty text', () => {
    expect(speechOf(null)).toBeNull();
    expect(speechOf('   ')).toBeNull();
  });
});

describe('MatchSheetService — scorers and red cards', () => {
  const event = (overrides: Partial<SheetEventRow>): SheetEventRow => ({
    ordinal: 0,
    teamId: 'ars',
    minute: 12,
    extraMinute: null,
    type: 'GOAL',
    detail: 'Normal Goal',
    comments: null,
    playerName: 'Konsa',
    ...overrides,
  });
  const finished = header({
    scheduledAt: new Date('2026-10-29T19:00:00.000Z'),
    status: 'FINISHED',
    homeScore: 2,
    awayScore: 0,
  });

  it('lists the goals and red cards of a finished match', async () => {
    const { service } = harness({
      header: finished,
      events: [
        event({
          ordinal: 2,
          minute: 45,
          extraMinute: 1,
          detail: 'Penalty',
          playerName: 'Gyökeres',
        }),
        event({ ordinal: 0 }),
        event({
          ordinal: 1,
          teamId: 'che',
          type: 'CARD',
          detail: 'Red Card',
          minute: 30,
          playerName: 'Caicedo',
        }),
      ],
    });

    const sheet = await service.getSheet(FX, NOW);

    expect(sheet.scorers).toEqual([
      {
        minute: 12,
        extraMinute: null,
        player: 'Konsa',
        team: 'home',
        kind: 'goal',
      },
      {
        minute: 45,
        extraMinute: 1,
        player: 'Gyökeres',
        team: 'home',
        kind: 'penalty',
      },
    ]);
    expect(sheet.redCards).toEqual([
      { minute: 30, extraMinute: null, player: 'Caicedo', team: 'away' },
    ]);
  });

  it('reads no event for a match still to come', async () => {
    const { service, fixtureEvents } = harness({});

    const sheet = await service.getSheet(FX, NOW);

    expect(fixtureEvents.findSheetEvents).not.toHaveBeenCalled();
    expect(sheet.scorers).toBeNull();
    expect(sheet.redCards).toBeNull();
  });

  it('shows nothing when the events are not in yet', async () => {
    const { service } = harness({ header: finished, events: [] });
    const sheet = await service.getSheet(FX, NOW);
    expect(sheet.scorers).toBeNull();
  });
});
