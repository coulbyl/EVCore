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
  monthsToCreate,
  partitionsDue,
  settledBefore,
  type OddsPartition,
} from './odds-archive.plan';
import { ParquetMonthWriter, type WrittenMonth } from './parquet-month.writer';

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
    const [partitions, archivedMonths] = await Promise.all([
      this.repo.listPartitions(),
      this.repo.archivedMonths(),
    ]);
    const ahead = monthsToCreate(partitions, now);
    for (const partition of ahead) await this.repo.createPartition(partition);
    const createdPartitions = ahead.map((p) => p.name);
    if (createdPartitions.length > 0) {
      logger.info({ createdPartitions }, 'Odds partitions created');
    }
    const due = partitionsDue({
      partitions,
      archivedMonths: new Set(archivedMonths.map(monthKey)),
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

  private async archivePartition(
    partition: OddsPartition,
    now: Date,
  ): Promise<ArchivedPartition> {
    const startedAt = Date.now();
    const writer = await ParquetMonthWriter.open();
    try {
      const { fingerprint } = await this.repo.exportPartition(
        partition.name,
        writer,
      );
      const target = compactedName(partition);
      const compact = `${target}_next`;
      // The files go up while the compact copy is built: only the swap
      // needs both.
      const [stored, kept] = await settleBoth(
        this.upload(writer),
        this.repo.buildCompact({
          partition,
          compact,
          settledBefore: settledBefore(now),
        }),
      );
      const journal: ArchivedMonthRow[] = stored.map(
        ({ aggregate, ...file }) => ({
          month: aggregate.month,
          objectKey: file.key,
          parquetBytes: BigInt(file.bytes),
          rowsTotal: aggregate.rows,
          rowsKept: kept.get(monthKey(aggregate.month)) ?? 0,
          oddsSum: aggregate.oddsSum,
        }),
      );
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
        parquetBytes: journal.reduce(
          (sum, row) => sum + Number(row.parquetBytes),
          0,
        ),
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

  private async upload(
    writer: ParquetMonthWriter,
  ): Promise<(WrittenMonth & { key: string; bytes: number })[]> {
    const stored: (WrittenMonth & { key: string; bytes: number })[] = [];
    for (const file of writer.written) {
      const key = archiveObjectKey(file.aggregate.month);
      const bytes = await this.storage.putFile({
        bucket: ODDS_ARCHIVE.BUCKET,
        key,
        filePath: file.path,
        contentType: 'application/vnd.apache.parquet',
      });
      stored.push({ ...file, key, bytes });
    }
    return stored;
  }
}

/**
 * Both, or the first failure once both are done: the work directory is
 * removed and the job ends only when neither still runs.
 */
async function settleBoth<A, B>(a: Promise<A>, b: Promise<B>): Promise<[A, B]> {
  const [ra, rb] = await Promise.allSettled([a, b]);
  if (ra.status === 'rejected') throw ra.reason;
  if (rb.status === 'rejected') throw rb.reason;
  return [ra.value, rb.value];
}
