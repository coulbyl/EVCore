import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RecordEventDto } from './record-event.dto';

async function errorsOf(body: object): Promise<string[]> {
  const errors = await validate(plainToInstance(RecordEventDto, body));
  return errors.map((error) => error.property);
}

describe('RecordEventDto', () => {
  it('requires the notification behind an open', async () => {
    expect(await errorsOf({ type: 'NOTIFICATION_OPENED' })).toEqual([
      'notificationType',
    ]);
    expect(
      await errorsOf({
        type: 'NOTIFICATION_OPENED',
        notificationType: 'MORNING_BRIEF',
      }),
    ).toEqual([]);
  });

  it('takes a completed tour alone, and refuses unknown types', async () => {
    expect(await errorsOf({ type: 'TOUR_COMPLETED' })).toEqual([]);
    expect(
      await errorsOf({ type: 'TOUR_COMPLETED', notificationType: 'X' }),
    ).toEqual(['notificationType']);
    expect(await errorsOf({ type: 'PAGE_VIEW' })).toEqual(['type']);
  });
});
