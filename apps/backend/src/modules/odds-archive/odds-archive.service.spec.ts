import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorageService } from '@modules/storage/storage.service';
import type { MonthAggregate } from './odds-archive.columns';
import type { OddsPartition } from './odds-archive.plan';
import type { OddsArchiveRepository } from './odds-archive.repository';
import { OddsArchiveService } from './odds-archive.service';

const writer = vi.hoisted(() => ({
  written: [] as { aggregate: unknown; path: string }[],
  close: vi.fn(() => Promise.resolve()),
}));
vi.mock('./parquet-month.writer', () => ({
  ParquetMonthWriter: { open: vi.fn(() => Promise.resolve(writer)) },
}));

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

const legacy: OddsPartition = {
  name: 'odds_snapshot_legacy',
  from: null,
  to: utc('2026-11-01'),
  isDefault: false,
};

const month = (iso: string, rows: number): MonthAggregate => ({
  month: utc(iso),
  rows,
  oddsSum: '12.500',
  firstAtMs: '1',
  lastAtMs: '2',
});

function setup(partitions: OddsPartition[]) {
  const fingerprint = { rows: 30, lastTouched: utc('2026-10-31') };
  const repo = {
    listPartitions: vi.fn(() => Promise.resolve(partitions)),
    archivedMonths: vi.fn(() => Promise.resolve([])),
    createPartition: vi.fn(() => Promise.resolve()),
    exportPartition: vi.fn(() => Promise.resolve({ fingerprint })),
    buildCompact: vi.fn(() =>
      Promise.resolve(
        new Map([
          ['2026-09', 4],
          ['2026-10', 6],
        ]),
      ),
    ),
    swap: vi.fn(() => Promise.resolve()),
    countDefaultRows: vi.fn(() => Promise.resolve(0)),
  };
  const storage = {
    putFile: vi.fn(() => Promise.resolve(1000)),
  };
  const service = new OddsArchiveService(
    repo as unknown as OddsArchiveRepository,
    storage as unknown as StorageService,
  );
  return { service, repo, storage, fingerprint };
}

describe('OddsArchiveService.run', () => {
  beforeEach(() => {
    writer.written = [];
    writer.close.mockClear();
  });

  it('creates the months ahead and leaves a partition not closed long enough', async () => {
    const { service, repo } = setup([legacy]);
    const result = await service.run(new Date('2026-11-10T03:30:00Z'));
    expect(result.createdPartitions).toEqual([
      'odds_snapshot_y2026m11',
      'odds_snapshot_y2026m12',
      'odds_snapshot_y2027m01',
    ]);
    expect(repo.createPartition).toHaveBeenCalledTimes(3);
    expect(repo.exportPartition).not.toHaveBeenCalled();
  });

  it('journals each stored month with its kept rows and swaps on the export fingerprint', async () => {
    const { service, repo, storage, fingerprint } = setup([legacy]);
    writer.written = [
      { aggregate: month('2026-09', 10), path: '/tmp/x/2026-09.parquet' },
      { aggregate: month('2026-10', 20), path: '/tmp/x/2026-10.parquet' },
    ];
    const result = await service.run(new Date('2026-11-16T03:30:00Z'));

    expect(storage.putFile).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'evcore-odds-archive',
        key: 'odds_snapshot/2026-10.parquet',
        filePath: '/tmp/x/2026-10.parquet',
      }),
    );
    expect(repo.buildCompact).toHaveBeenCalledWith(
      expect.objectContaining({
        compact: 'odds_snapshot_history_next',
        settledBefore: new Date('2026-11-09T03:30:00Z'),
      }),
    );
    expect(repo.swap).toHaveBeenCalledWith({
      partition: legacy,
      compact: 'odds_snapshot_history_next',
      target: 'odds_snapshot_history',
      expected: fingerprint,
      journal: [
        {
          month: utc('2026-09-01'),
          objectKey: 'odds_snapshot/2026-09.parquet',
          parquetBytes: 1000n,
          rowsTotal: 10,
          rowsKept: 4,
          oddsSum: '12.500',
        },
        {
          month: utc('2026-10-01'),
          objectKey: 'odds_snapshot/2026-10.parquet',
          parquetBytes: 1000n,
          rowsTotal: 20,
          rowsKept: 6,
          oddsSum: '12.500',
        },
      ],
    });
    expect(result.archived).toEqual([
      {
        partition: 'odds_snapshot_legacy',
        months: ['2026-09', '2026-10'],
        rowsTotal: 30,
        rowsKept: 10,
        parquetBytes: 2000,
      },
    ]);
    expect(writer.close).toHaveBeenCalled();
  });

  it('touches nothing when an upload fails, once the compaction has finished', async () => {
    const { service, repo, storage } = setup([legacy]);
    writer.written = [
      { aggregate: month('2026-10', 20), path: '/tmp/x/2026-10.parquet' },
    ];
    storage.putFile.mockRejectedValueOnce(new Error('rustfs down'));
    let compactDone = false;
    repo.buildCompact.mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      compactDone = true;
      return new Map();
    });

    await expect(service.run(new Date('2026-11-16T03:30:00Z'))).rejects.toThrow(
      'rustfs down',
    );
    expect(compactDone).toBe(true);
    expect(repo.swap).not.toHaveBeenCalled();
    expect(writer.close).toHaveBeenCalled();
  });

  it('notes an empty month partition so it is not retried', async () => {
    const november: OddsPartition = {
      name: 'odds_snapshot_y2026m11',
      from: utc('2026-11-01'),
      to: utc('2026-12-01'),
      isDefault: false,
    };
    const { service, repo } = setup([november]);
    await service.run(new Date('2026-12-16T03:30:00Z'));
    expect(repo.swap).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'odds_snapshot_y2026m11',
        journal: [
          expect.objectContaining({
            month: utc('2026-11-01'),
            objectKey: '',
            rowsTotal: 0,
          }),
        ],
      }),
    );
  });
});
