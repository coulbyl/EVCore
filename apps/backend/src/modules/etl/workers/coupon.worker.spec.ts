import { describe, it, expect } from 'vitest';
import { resolveGenerationWindow } from './coupon.worker';

// Weekend (Fri→Sun) and midweek European-nights (Tue→Thu) coupon windows —
// every other day of the week stays single-day.
describe('resolveGenerationWindow', () => {
  it('extends Friday to Sunday, tagged LONGSHOT_WEEKEND', () => {
    expect(resolveGenerationWindow('2026-08-07')).toEqual({
      to: '2026-08-09',
      longshotProfile: 'LONGSHOT_WEEKEND',
    });
  });

  it('extends Tuesday to Thursday, tagged LONGSHOT_MIDWEEK', () => {
    expect(resolveGenerationWindow('2026-08-11')).toEqual({
      to: '2026-08-13',
      longshotProfile: 'LONGSHOT_MIDWEEK',
    });
  });

  it('keeps every other day single-day with no longshot profile', () => {
    expect(resolveGenerationWindow('2026-08-08')).toEqual({
      to: '2026-08-08',
      longshotProfile: null,
    }); // Saturday
    expect(resolveGenerationWindow('2026-08-09')).toEqual({
      to: '2026-08-09',
      longshotProfile: null,
    }); // Sunday
    expect(resolveGenerationWindow('2026-08-10')).toEqual({
      to: '2026-08-10',
      longshotProfile: null,
    }); // Monday
    expect(resolveGenerationWindow('2026-08-12')).toEqual({
      to: '2026-08-12',
      longshotProfile: null,
    }); // Wednesday
    expect(resolveGenerationWindow('2026-08-13')).toEqual({
      to: '2026-08-13',
      longshotProfile: null,
    }); // Thursday
  });

  it('is correct across a month boundary', () => {
    // 2026-01-30 is a Friday.
    expect(resolveGenerationWindow('2026-01-30')).toEqual({
      to: '2026-02-01',
      longshotProfile: 'LONGSHOT_WEEKEND',
    });
  });
});
