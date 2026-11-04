import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { TicketQuoteDto } from './ticket-quote.dto';

const leg = (n: number) => ({
  fixtureId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  market: 'ONE_X_TWO',
  pick: 'HOME',
});

async function errorsFor(input: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(plainToInstance(TicketQuoteDto, input));
  return errors.flatMap((e) => [
    e.property,
    ...(e.children ?? []).flatMap((c) =>
      (c.children ?? []).map((g) => `${e.property}.${g.property}`),
    ),
  ]);
}

describe('TicketQuoteDto', () => {
  it('accepts one to fifteen bets', async () => {
    expect(await errorsFor({ legs: [leg(1)] })).toEqual([]);
    expect(
      await errorsFor({
        legs: Array.from({ length: 15 }, (_, i) => leg(i)),
        verify: true,
      }),
    ).toEqual([]);
  });

  it('refuses an empty ticket or more than 15 bets', async () => {
    expect(await errorsFor({ legs: [] })).toEqual(['legs']);
    expect(
      await errorsFor({ legs: Array.from({ length: 16 }, (_, i) => leg(i)) }),
    ).toEqual(['legs']);
  });

  it('refuses a match that is not an id and a market that is not a code', async () => {
    expect(
      await errorsFor({ legs: [{ ...leg(1), fixtureId: 'nope' }] }),
    ).toContain('legs.fixtureId');
    expect(
      await errorsFor({ legs: [{ ...leg(1), market: "1X2'; --" }] }),
    ).toContain('legs.market');
  });

  it('takes a day to compare with, as a date only', async () => {
    expect(await errorsFor({ legs: [leg(1)], day: '2026-10-30' })).toEqual([]);
    expect(await errorsFor({ legs: [leg(1)], day: '30/10/2026' })).toEqual([
      'day',
    ]);
  });

  it('keeps the line and the player of a new market, a line in hundredths', async () => {
    expect(
      await errorsFor({
        legs: [
          { ...leg(1), market: 'CORNERS', pick: 'OVER', line: 9.5 },
          { ...leg(2), market: 'GOAL_SCORER_ANYTIME', pick: 'P1100' },
          { ...leg(3), market: 'MINUTE_1X2', pick: 'DRAW', line: 15 },
          { ...leg(4), line: null },
        ],
      }),
    ).toEqual([]);
    for (const line of [-1, 9.555, 'nine', 500]) {
      expect(
        await errorsFor({ legs: [{ ...leg(1), market: 'CARDS', line }] }),
      ).toContain('legs.line');
    }
  });
});
