import { Injectable } from '@nestjs/common';
import { ODDS_ARCHIVE } from '@config/odds-archive.constants';
import { StorageService } from '@modules/storage/storage.service';
import { createLogger } from '@utils/logger';
import {
  OddsArchiveRepository,
  type ArchivedMonthRow,
} from './odds-archive.repository';
import {
  archiveObjectKey,
  compactedName,
  monthKey,
  monthPartitionName,
  monthsToCreate,
  partitionsDue,
  settledBefore,
  addMonths,
  type OddsPartition,
} from './odds-archive.plan';
import { ParquetMonthWriter } from './parquet-month.writer';

const logger = createLogger('odds-archive');

export type ArchivedPartition = {
  partition: string;
  months: string[];
  rowsTotal: number;
  rowsKept: number;
  parquetBytes: number;
};

export type OddsArchiveRun = {
  createdPartitions: string[];
  archived: ArchivedPartition[];
  defaultRows: number;
};

/**
 * The nightly archive of `odds_snapshot` (docs/audits/2026-11-03/
 * ODDS-ARCHIVE.md): partitions laid out ahead, then each closed partition
 * exported whole to Parquet, checked, uploaded, and replaced by its compact
 * copy. A partition that fails stays as it was and is retried the next
 * night; nothing is deleted before its file is stored and verified.
 */
@Injectable()
export class OddsArchiveService {
  constructor(
    private readonly repo: OddsArchiveRepository,
    private readonly storage: StorageService,
  ) {}

  async run(now: Date = new Date()): Promise<OddsArchiveRun> {
    const createdPartitions = await this.createAhead(now);
    const due = partitionsDue({
      partitions: await this.repo.listPartitions(),
      archivedMonths: new Set((await this.repo.archivedMonths()).map(monthKey)),
      now,
    });
    const archived: ArchivedPartition[] = [];
    for (const partition of due) {
      archived.push(await this.archivePartition(partition, now));
    }
    // Must stay empty: a row here means a month partition was missing.
    const defaultRows = await this.repo.countDefaultRows();
    if (defaultRows > 0) {
      logger.error({ defaultRows }, 'Odds landed in the default partition');
    }
    return { createdPartitions, archived, defaultRows };
  }

  private async createAhead(now: Date): Promise<string[]> {
    const created: string[] = [];
    for (const month of monthsToCreate(await this.repo.listPartitions(), now)) {
      const partition: OddsPartition = {
        name: monthPartitionName(month),
        from: month,
        to: addMonths(month, 1),
        isDefault: false,
      };
      await this.repo.createPartition(partition);
      created.push(partition.name);
    }
    if (created.length > 0) logger.info({ created }, 'Odds partitions created');
    return created;
  }

  private async archivePartition(
    partition: OddsPartition,
    now: Date,
  ): Promise<ArchivedPartition> {
    const startedAt = Date.now();
    const writer = await ParquetMonthWriter.open();
    try {
      const { fingerprint, months } = await this.repo.exportPartition(
        partition.name,
        {
          startMonth: () => writer.startMonth(),
          append: (rows) => writer.append(rows),
          endMonth: async (aggregate) => {
            await writer.endMonth(aggregate);
          },
        },
      );
      const stored = new Map<string, { key: string; bytes: number }>();
      for (const file of writer.written) {
        const key = archiveObjectKey(file.month);
        const bytes = await this.storage.putFile({
          bucket: ODDS_ARCHIVE.BUCKET,
          key,
          filePath: file.path,
        });
        stored.set(monthKey(file.month), { key, bytes });
      }

      const target = compactedName(partition);
      const compact = `${target}_next`;
      const kept = await this.repo.buildCompact({
        partition,
        compact,
        settledBefore: settledBefore(now),
      });
      const journal: ArchivedMonthRow[] = months.map((aggregate) => {
        const key = monthKey(aggregate.month);
        const file = stored.get(key);
        if (!file) throw new Error(`No stored file for ${key}`);
        return {
          month: aggregate.month,
          objectKey: file.key,
          parquetBytes: BigInt(file.bytes),
          rowsTotal: aggregate.rows,
          rowsKept: kept.get(key) ?? 0,
          oddsSum: aggregate.oddsSum,
        };
      });
      // An empty month partition is noted too, so it is not retried.
      if (journal.length === 0 && partition.from) {
        journal.push({
          month: partition.from,
          objectKey: '',
          parquetBytes: 0n,
          rowsTotal: 0,
          rowsKept: 0,
          oddsSum: '0',
        });
      }
      await this.repo.swap({
        partition,
        compact,
        target,
        expected: fingerprint,
        journal,
      });

      const result: ArchivedPartition = {
        partition: partition.name,
        months: journal.map((row) => monthKey(row.month)),
        rowsTotal: journal.reduce((sum, row) => sum + row.rowsTotal, 0),
        rowsKept: journal.reduce((sum, row) => sum + row.rowsKept, 0),
        parquetBytes: [...stored.values()].reduce((s, f) => s + f.bytes, 0),
      };
      logger.info(
        { ...result, durationMs: Date.now() - startedAt },
        'Odds partition archived',
      );
      return result;
    } finally {
      await writer.close();
    }
  }
}
