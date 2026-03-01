import { describe, it, expect } from 'vitest';
import { OddsCsvRowSchema } from './odds-csv.schema';

const validRow = {
  Date: '05/08/2022',
  HomeTeam: 'Crystal Palace',
  AwayTeam: 'Arsenal',
  FTHG: '0',
  FTAG: '2',
  FTR: 'A',
  // optional odds columns absent → valid
};

const withAllOdds = {
  ...validRow,
  B365H: '3.50',
  B365D: '3.40',
  B365A: '2.10',
  B365CH: '3.60',
  B365CD: '3.30',
  B365CA: '2.05',
  PSCH: '3.55',
  PSCD: '3.35',
  PSCA: '2.08',
  AvgCH: '3.52',
  AvgCD: '3.32',
  AvgCA: '2.06',
  // Extra CSV columns are silently ignored (.passthrough)
  Season: '2022',
  Div: 'E0',
};

describe('OddsCsvRowSchema', () => {
  it('accepts a valid row without optional odds columns', () => {
    expect(OddsCsvRowSchema.safeParse(validRow).success).toBe(true);
  });

  it('accepts a valid row with all odds columns present', () => {
    expect(OddsCsvRowSchema.safeParse(withAllOdds).success).toBe(true);
  });

  it('coerces string goal counts to integers (CSV values are strings)', () => {
    const result = OddsCsvRowSchema.safeParse(validRow);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.FTHG).toBe(0);
    expect(result.data.FTAG).toBe(2);
  });

  it('coerces string odds to numbers', () => {
    const result = OddsCsvRowSchema.safeParse(withAllOdds);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.PSCH).toBe(3.55);
  });

  it('passes through extra CSV columns silently', () => {
    const result = OddsCsvRowSchema.safeParse(withAllOdds);
    expect(result.success).toBe(true);
    if (!result.success) return;
    // passthrough keeps extra keys
    expect((result.data as Record<string, unknown>)['Div']).toBe('E0');
  });

  it('accepts a 0-0 draw (FTR: D)', () => {
    const row = { ...validRow, FTHG: '0', FTAG: '0', FTR: 'D' };
    expect(OddsCsvRowSchema.safeParse(row).success).toBe(true);
  });

  it('rejects an invalid date format (YYYY-MM-DD instead of DD/MM/YYYY)', () => {
    expect(
      OddsCsvRowSchema.safeParse({ ...validRow, Date: '2022-08-05' }).success,
    ).toBe(false);
  });

  it('rejects an unknown FTR value', () => {
    expect(OddsCsvRowSchema.safeParse({ ...validRow, FTR: 'X' }).success).toBe(
      false,
    );
  });

  it('rejects empty HomeTeam', () => {
    expect(
      OddsCsvRowSchema.safeParse({ ...validRow, HomeTeam: '' }).success,
    ).toBe(false);
  });

  it('rejects negative FTHG', () => {
    expect(
      OddsCsvRowSchema.safeParse({ ...validRow, FTHG: '-1' }).success,
    ).toBe(false);
  });

  it('rejects non-integer FTHG (float)', () => {
    expect(
      OddsCsvRowSchema.safeParse({ ...validRow, FTHG: '1.5' }).success,
    ).toBe(false);
  });

  it('rejects odd <= 1.0', () => {
    expect(
      OddsCsvRowSchema.safeParse({ ...validRow, PSCH: '1.00' }).success,
    ).toBe(false);
    expect(
      OddsCsvRowSchema.safeParse({ ...validRow, PSCH: '0.90' }).success,
    ).toBe(false);
  });

  it('rejects odd >= 1000', () => {
    expect(
      OddsCsvRowSchema.safeParse({ ...validRow, PSCH: '1000' }).success,
    ).toBe(false);
  });

  it('rejects non-numeric odds string', () => {
    expect(
      OddsCsvRowSchema.safeParse({ ...validRow, B365H: 'N/A' }).success,
    ).toBe(false);
  });
});
