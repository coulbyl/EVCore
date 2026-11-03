import { describe, expect, it } from 'vitest';
import {
  archiveObjectKey,
  compactedName,
  monthPartitionName,
  monthsToCreate,
  parsePartitionBound,
  partitionsDue,
  type OddsPartition,
} from './odds-archive.plan';

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

function month(iso: string, next: string): OddsPartition {
  return {
    name: monthPartitionName(utc(iso)),
    from: utc(iso),
    to: utc(next),
    isDefault: false,
  };
}

const legacy: OddsPartition = {
  name: 'odds_snapshot_legacy',
  from: null,
  to: utc('2026-11-01'),
  isDefault: false,
};

describe('parsePartitionBound', () => {
  it('reads a month range as UTC', () => {
    expect(
      parsePartitionBound(
        'odds_snapshot_y2026m11',
        "FOR VALUES FROM ('2026-11-01 00:00:00') TO ('2026-12-01 00:00:00')",
      ),
    ).toEqual(month('2026-11-01', '2026-12-01'));
  });

  it('reads MINVALUE and DEFAULT', () => {
    expect(
      parsePartitionBound(
        'odds_snapshot_legacy',
        "FOR VALUES FROM (MINVALUE) TO ('2026-11-01 00:00:00')",
      ),
    ).toEqual(legacy);
    expect(parsePartitionBound('odds_snapshot_default', 'DEFAULT')).toEqual({
      name: 'odds_snapshot_default',
      from: null,
      to: null,
      isDefault: true,
    });
  });

  it('refuses what it cannot read rather than guessing', () => {
    expect(() => parsePartitionBound('x', 'FOR VALUES IN (1)')).toThrow();
  });
});

describe('names', () => {
  it('names partitions and files by month', () => {
    expect(monthPartitionName(utc('2027-01-01'))).toBe(
      'odds_snapshot_y2027m01',
    );
    expect(archiveObjectKey(utc('2026-10-01'))).toBe(
      'odds_snapshot/2026-10.parquet',
    );
  });

  it('replaces the old table by the history, a month by itself', () => {
    expect(compactedName(legacy)).toBe('odds_snapshot_history');
    expect(compactedName(month('2026-11-01', '2026-12-01'))).toBe(
      'odds_snapshot_y2026m11',
    );
  });
});

describe('monthsToCreate', () => {
  it('lays out this month and the next two, the missing ones only', () => {
    const existing = [month('2026-11-01', '2026-12-01'), legacy];
    expect(monthsToCreate(existing, new Date('2026-11-30T23:00:00Z'))).toEqual([
      utc('2026-12-01'),
      utc('2027-01-01'),
    ]);
  });
});

describe('partitionsDue', () => {
  const partitions = [
    legacy,
    month('2026-11-01', '2026-12-01'),
    month('2026-12-01', '2027-01-01'),
    {
      name: 'odds_snapshot_default',
      from: null,
      to: null,
      isDefault: true,
    },
  ];

  it('waits 14 days after the end of the range', () => {
    expect(
      partitionsDue({
        partitions,
        archivedMonths: new Set(),
        now: new Date('2026-11-14T23:59:00Z'),
      }),
    ).toEqual([]);
    expect(
      partitionsDue({
        partitions,
        archivedMonths: new Set(),
        now: new Date('2026-12-15T03:30:00Z'),
      }).map((p) => p.name),
    ).toEqual(['odds_snapshot_legacy', 'odds_snapshot_y2026m11']);
  });

  it('never redoes a month in the journal, nor the history or the default', () => {
    expect(
      partitionsDue({
        partitions: [
          { ...legacy, name: 'odds_snapshot_history' },
          ...partitions.slice(1),
        ],
        archivedMonths: new Set(['2026-11']),
        now: new Date('2027-03-01T03:30:00Z'),
      }).map((p) => p.name),
    ).toEqual(['odds_snapshot_y2026m12']);
  });
});
