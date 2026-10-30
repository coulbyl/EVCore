import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@evcore/db';
import { MATCHES_PAGE_SIZE } from '@config/screens.constants';
import type {
  PlayableOddsRepository,
  PlayableQuote,
} from '@modules/betting-engine/pricing/playable-odds.repository';
import type {
  MatchRow,
  MatchesRepository,
  ReadingCandidateRow,
} from './matches.repository';
import { MatchesService } from './matches.service';

const NOW = new Date('2026-10-30T15:00:00.000Z');

function match(overrides: Partial<MatchRow> = {}): MatchRow {
  return {
    fixtureId: '0190a000-0000-7000-8000-000000000001',
    scheduledAt: new Date('2026-10-30T19:00:00.000Z'),
    status: 'SCHEDULED',
    homeScore: null,
    awayScore: null,
    homeName: 'Arsenal',
    homeShortName: 'ARS',
    homeLogoUrl: null,
    awayName: 'Chelsea',
    awayShortName: 'CHE',
    awayLogoUrl: null,
    competitionCode: 'PL',
    competitionName: 'Premier League',
    leagueRank: 2,
    ...overrides,
  };
}

const FX = match().fixtureId;

function candidate(
  overrides: Partial<ReadingCandidateRow> = {},
): ReadingCandidateRow {
  return {
    fixtureId: FX,
    avoided: false,
    channel: 'DOMINANT',
    market: 'ONE_X_TWO',
    pick: 'HOME',
    probability: new Prisma.Decimal('0.7000'),
    result: null,
    ...overrides,
  };
}

function quote(
  market: string,
  pick: string,
  overrides: Partial<PlayableQuote> = {},
): [string, PlayableQuote] {
  return [
    `${FX}|${market}|${pick}`,
    {
      fixtureId: FX,
      market,
      pick,
      operatorOdds: 1.65,
      operatorBookmaker: '1xBet',
      operatorMargin: 0.05,
      operatorFairProbability: 0.58,
      lowestOdds: 1.62,
      lowestBookmaker: 'Bet365',
      ...overrides,
    },
  ];
}

function harness(input: {
  rows?: MatchRow[];
  candidates?: ReadingCandidateRow[];
  quotes?: [string, PlayableQuote][];
}) {
  const repository = {
    findDayPage: vi.fn().mockResolvedValue(input.rows ?? [match()]),
    findReadingCandidates: vi.fn().mockResolvedValue(input.candidates ?? []),
  } as unknown as MatchesRepository;
  const playableOdds = {
    findPlayableQuotes: vi.fn().mockResolvedValue(new Map(input.quotes ?? [])),
  } as unknown as PlayableOddsRepository;
  return {
    service: new MatchesService(repository, playableOdds),
    repository,
    playableOdds,
  };
}

describe('MatchesService', () => {
  it('reads the UTC day asked, one page plus one to know if more follow', async () => {
    const { service, repository } = harness({});
    const screen = await service.getMatches({ day: 'yesterday' }, NOW);
    expect(screen.date).toBe('2026-10-29');
    expect(repository.findDayPage).toHaveBeenCalledWith(
      expect.objectContaining({
        from: new Date('2026-10-29T00:00:00.000Z'),
        to: new Date('2026-10-30T00:00:00.000Z'),
        limit: MATCHES_PAGE_SIZE + 1,
        after: null,
        search: null,
      }),
    );
    expect(screen.nextCursor).toBeNull();
  });

  it('hands out a cursor that reads back as the last row of the page', async () => {
    const rows = Array.from({ length: MATCHES_PAGE_SIZE + 1 }, (_, i) =>
      match({
        fixtureId: `0190a000-0000-7000-8000-${String(i).padStart(12, '0')}`,
      }),
    );
    const first = harness({ rows });
    const page = await first.service.getMatches({ day: 'today' }, NOW);
    expect(page.items).toHaveLength(MATCHES_PAGE_SIZE);
    expect(page.nextCursor).not.toBeNull();

    const second = harness({ rows: [] });
    await second.service.getMatches(
      { day: 'today', cursor: page.nextCursor ?? '' },
      NOW,
    );
    expect(second.repository.findDayPage).toHaveBeenCalledWith(
      expect.objectContaining({
        after: {
          scheduledAt: '2026-10-30T19:00:00.000Z',
          leagueRank: 2,
          competitionName: 'Premier League',
          fixtureId: rows[MATCHES_PAGE_SIZE - 1]?.fixtureId,
        },
      }),
    );
  });

  it('reads a page once for the players who open it together', async () => {
    const { service, repository, playableOdds } = harness({});
    await Promise.all([
      service.getMatches({ day: 'today' }, NOW),
      service.getMatches({ day: 'today' }, new Date(NOW.getTime() + 1_000)),
    ]);
    expect(repository.findDayPage).toHaveBeenCalledTimes(1);
    expect(playableOdds.findPlayableQuotes).toHaveBeenCalledTimes(1);
    // Another day, another search: their own reads.
    await service.getMatches({ day: 'tomorrow' }, NOW);
    await service.getMatches({ day: 'today', search: 'Lens' }, NOW);
    expect(repository.findDayPage).toHaveBeenCalledTimes(3);
  });

  it('refuses a cursor it did not write', async () => {
    const { service } = harness({});
    await expect(
      service.getMatches({ day: 'today', cursor: 'not-a-cursor' }, NOW),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('shows the best chance among the picks 1xBet prices at 1,20 or more', async () => {
    const { service } = harness({
      candidates: [
        candidate(),
        // Better chance, but 1xBet pays under the floor.
        candidate({
          channel: 'TEAM_TOTAL',
          market: 'TEAM_TOTAL_HOME',
          pick: 'OVER_0_5',
          probability: new Prisma.Decimal('0.9300'),
        }),
        candidate({
          channel: 'GOALS',
          market: 'OVER_UNDER',
          pick: 'OVER_1_5',
          probability: new Prisma.Decimal('0.8500'),
        }),
      ],
      quotes: [
        quote('ONE_X_TWO', 'HOME'),
        quote('TEAM_TOTAL_HOME', 'OVER_0_5', { operatorOdds: 1.08 }),
        quote('OVER_UNDER', 'OVER_1_5', { operatorOdds: 1.3 }),
      ],
    });
    const [item] = (await service.getMatches({ day: 'today' }, NOW)).items;
    expect(item?.reading).toEqual({
      market: 'OVER_UNDER',
      pick: 'OVER_1_5',
      odds: 1.3,
      chance: 0.85,
      result: null,
    });
    expect(item?.withoutReading).toBeNull();
  });

  it('prefers who wins, double chance or 2.5 goals within 10 points of the best', async () => {
    const teamScores = candidate({
      channel: 'TEAM_TOTAL',
      market: 'TEAM_TOTAL_HOME',
      pick: 'OVER_0_5',
      probability: new Prisma.Decimal('0.8000'),
    });
    const quotes: [string, PlayableQuote][] = [
      quote('ONE_X_TWO', 'HOME'),
      quote('TEAM_TOTAL_HOME', 'OVER_0_5', { operatorOdds: 1.25 }),
      quote('OVER_UNDER', 'OVER_1_5', { operatorOdds: 1.22 }),
    ];
    // 0.80 against 0.70: the home win is within the tolerance.
    const within = harness({ candidates: [candidate(), teamScores], quotes });
    const [near] = (await within.service.getMatches({ day: 'today' }, NOW))
      .items;
    expect(near?.reading).toMatchObject({ market: 'ONE_X_TWO', pick: 'HOME' });

    // 0.81 against 0.70: the best chance stays.
    const beyond = harness({
      candidates: [
        candidate(),
        { ...teamScores, probability: new Prisma.Decimal('0.8100') },
      ],
      quotes,
    });
    const [far] = (await beyond.service.getMatches({ day: 'today' }, NOW))
      .items;
    expect(far?.reading).toMatchObject({
      market: 'TEAM_TOTAL_HOME',
      pick: 'OVER_0_5',
    });

    // Over 1.5 is not the 2.5 line: not a speaking pick.
    const lowLine = harness({
      candidates: [
        candidate({
          channel: 'GOALS',
          market: 'OVER_UNDER',
          pick: 'OVER_1_5',
          probability: new Prisma.Decimal('0.7500'),
        }),
        teamScores,
      ],
      quotes,
    });
    const [line] = (await lowLine.service.getMatches({ day: 'today' }, NOW))
      .items;
    expect(line?.reading).toMatchObject({ market: 'TEAM_TOTAL_HOME' });
  });

  it("above 1,80 the chance is the market's; without it the pick is left out", async () => {
    const draw = candidate({
      channel: 'DRAW',
      market: 'ONE_X_TWO',
      pick: 'DRAW',
      probability: new Prisma.Decimal('0.3400'),
    });
    const priced = harness({
      candidates: [draw],
      quotes: [
        quote('ONE_X_TWO', 'DRAW', {
          operatorOdds: 3.3,
          operatorFairProbability: 0.29,
        }),
      ],
    });
    const [item] = (await priced.service.getMatches({ day: 'today' }, NOW))
      .items;
    expect(item?.reading?.chance).toBe(0.29);

    const unknown = harness({
      candidates: [draw],
      quotes: [
        quote('ONE_X_TWO', 'DRAW', {
          operatorOdds: 3.3,
          operatorFairProbability: null,
        }),
      ],
    });
    const [none] = (await unknown.service.getMatches({ day: 'today' }, NOW))
      .items;
    expect(none?.reading).toBeNull();
    expect(none?.withoutReading).toBe('rejected');
  });

  it('says why a match has no reading', async () => {
    const reason = async (
      day: 'today' | 'tomorrow',
      candidates: ReadingCandidateRow[],
      quotes: [string, PlayableQuote][] = [],
    ) => {
      const { service } = harness({ candidates, quotes });
      return (await service.getMatches({ day }, NOW)).items[0]?.withoutReading;
    };
    expect(await reason('today', [])).toBe('not_analysed');
    expect(await reason('tomorrow', [])).toBe('tonight');
    expect(
      await reason(
        'today',
        [candidate({ avoided: true })],
        [quote('ONE_X_TWO', 'HOME')],
      ),
    ).toBe('rejected');
    // Analysed, a pick, no 1xBet price for it.
    expect(await reason('today', [candidate()])).toBe('not_priced');
    // Analysed, no pick on a channel the player sees.
    expect(
      await reason('today', [
        candidate({
          channel: null,
          market: null,
          pick: null,
          probability: null,
        }),
      ]),
    ).toBe('rejected');
  });

  it("yesterday: the score, and the reading's mark", async () => {
    const { service } = harness({
      rows: [
        match({
          status: 'FINISHED',
          homeScore: 2,
          awayScore: 0,
          scheduledAt: new Date('2026-10-29T19:00:00.000Z'),
        }),
      ],
      candidates: [candidate({ result: 'WON' })],
      quotes: [quote('ONE_X_TWO', 'HOME')],
    });
    const [item] = (await service.getMatches({ day: 'yesterday' }, NOW)).items;
    expect(item).toMatchObject({
      state: 'finished',
      score: { home: 2, away: 0 },
      reading: { result: 'won' },
    });
  });
});
