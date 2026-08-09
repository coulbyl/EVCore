import { describe, it, expect } from 'vitest';
import { resolveGenerationWindow } from './coupon.worker';

// Weekend (Fri→Sun) and midweek European-nights (Tue→Thu) coupon windows —
// every other day of the week stays single-day.
describe('resolveGenerationWindow', () => {
  it('extends Friday to Sunday', () => {
    expect(resolveGenerationWindow('2026-08-07')).toEqual({
      to: '2026-08-09',
    });
  });

  it('extends Tuesday to Thursday', () => {
    expect(resolveGenerationWindow('2026-08-11')).toEqual({
      to: '2026-08-13',
    });
  });

  it('keeps every other day single-day', () => {
    expect(resolveGenerationWindow('2026-08-08')).toEqual({
      to: '2026-08-08',
    }); // Saturday
    expect(resolveGenerationWindow('2026-08-09')).toEqual({
      to: '2026-08-09',
    }); // Sunday
    expect(resolveGenerationWindow('2026-08-10')).toEqual({
      to: '2026-08-10',
    }); // Monday
    expect(resolveGenerationWindow('2026-08-12')).toEqual({
      to: '2026-08-12',
    }); // Wednesday
    expect(resolveGenerationWindow('2026-08-13')).toEqual({
      to: '2026-08-13',
    }); // Thursday
  });

  it('is correct across a month boundary', () => {
    // 2026-01-30 is a Friday.
    expect(resolveGenerationWindow('2026-01-30')).toEqual({
      to: '2026-02-01',
    });
  });
});
