import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@evcore/db';
import type {
  PlayableOddsRepository,
  PlayableQuote,
} from '@modules/betting-engine/pricing/playable-odds.repository';
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
import {
  MatchSheetService,
  speechOf,
  setAsideReasonOf,
} from './match-sheet.service';

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
}) {
  const repository = {
    findSheetHeader: vi
      .fn()
      .mockResolvedValue(input.header === undefined ? header() : input.header),
    findReadingCandidates: vi
      .fn()
      .mockResolvedValue(input.candidates ?? [candidate()]),
    findAiOpinion: vi.fn().mockResolvedValue(input.ai ?? []),
    findRejectionReasons: vi.fn().mockResolvedValue(input.reasons ?? []),
  } as unknown as MatchesRepository;
  const playableOdds = {
    findPlayableQuotes: vi
      .fn()
      .mockResolvedValue(new Map(input.quotes ?? QUOTES)),
  } as unknown as PlayableOddsRepository;
  const history = {
    findTeamHistories: vi.fn().mockResolvedValue(input.history ?? homeWins(6)),
  } as unknown as LegFactRepository;
  return {
    service: new MatchSheetService(repository, playableOdds, history),
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
      odds: 1.65,
      chance: 0.7,
      result: null,
      fact: 'Arsenal a gagné ses 6 derniers matchs à domicile',
    });
    expect(sheet.operatorMargin).toBe(0.07);
  });

  it("the AI's pick is one more pick, with the market's chance", async () => {
    const sheet = await harness({
      ai: [
        {
          status: 'SELECTED',
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
      odds: 3.4,
      chance: 0.27,
      result: null,
      sameAsReading: false,
      speech:
        'Chelsea n’a perdu qu’une fois en huit déplacements. Le reste du texte.',
    });
    // Neither the reading nor the AI's pick come back in « Autres paris ».
    expect(sheet.otherPicks.map((p) => `${p.market}/${p.pick}`)).toEqual([
      'ONE_X_TWO/AWAY',
      'OVER_UNDER/OVER',
      'OVER_UNDER/UNDER',
      'BTTS/YES',
    ]);
  });

  it('says when the AI played our pick, and nothing when it did not play', async () => {
    const same = await harness({
      ai: [
        {
          status: 'SELECTED',
          text: null,
          market: 'ONE_X_TWO',
          pick: 'HOME',
          result: null,
        },
      ],
    }).service.getSheet(FX, NOW);
    expect(same.ai?.sameAsReading).toBe(true);
    const silent = await harness({
      ai: [
        {
          status: 'REJECTED',
          text: 'x',
          market: null,
          pick: null,
          result: null,
        },
      ],
    }).service.getSheet(FX, NOW);
    expect(silent.ai).toBeNull();
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
      odds: 1.65,
      chance: 0.58,
      result: null,
    });
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
  it('keeps every clean sentence, however long', () => {
    const text =
      'Barcelona crée en moyenne plus de 3 buts attendus alors qu’Alavés n’en concède que 1,2; leurs confrontations récentes affichent souvent plus de 2,5 buts. Ces indicateurs suggèrent que le match dépassera les 2,5 buts.';
    expect(speechOf(text)).toBe(text);
  });

  it('leaves out the sentences with jargon', () => {
    expect(
      speechOf(
        'Les deux équipes affichent des xG combinés supérieurs à 3,4. Lens reste sur cinq matchs sans défaite.',
      ),
    ).toBe('Lens reste sur cinq matchs sans défaite.');
    expect(speechOf('Nos données internes indiquent une tendance.')).toBeNull();
    expect(speechOf('Probabilité de 47 % que les deux marquent.')).toBeNull();
    expect(speechOf(null)).toBeNull();
  });

  it('stops at a whole sentence past the length cap', () => {
    const sentence = `${'Une phrase propre et assez longue '.repeat(3)}.`;
    const speech = speechOf(sentence.repeat(10).replace(/\.(?=U)/g, '. '));
    expect(speech?.length).toBeLessThanOrEqual(400);
    expect(speech?.endsWith('.')).toBe(true);
  });
});
