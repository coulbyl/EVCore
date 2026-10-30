import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { RecordVerifiedTicketDto } from './record-verified-ticket.dto';

async function errorsFor(input: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(
    plainToInstance(RecordVerifiedTicketDto, input),
  );
  return errors.map((e) => e.property);
}

const ticket = { legCount: 3, totalOdds: 2.5, chance: 0.31 };

describe('RecordVerifiedTicketDto', () => {
  it('accepts a ticket shape', async () => {
    expect(await errorsFor(ticket)).toEqual([]);
  });

  it('refuses more than 15 bets, or none', async () => {
    expect(await errorsFor({ ...ticket, legCount: 16 })).toEqual(['legCount']);
    expect(await errorsFor({ ...ticket, legCount: 0 })).toEqual(['legCount']);
  });

  it('refuses a chance of zero or above one', async () => {
    expect(await errorsFor({ ...ticket, chance: 0 })).toEqual(['chance']);
    expect(await errorsFor({ ...ticket, chance: 1.2 })).toEqual(['chance']);
  });

  it('refuses odds below 1', async () => {
    expect(await errorsFor({ ...ticket, totalOdds: 0.9 })).toEqual([
      'totalOdds',
    ]);
  });
});
