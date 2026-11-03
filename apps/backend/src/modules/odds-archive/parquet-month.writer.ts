import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DuckDBInstance,
  type DuckDBAppender,
  type DuckDBConnection,
} from '@duckdb/node-api';
import { ODDS_ARCHIVE } from '@config/odds-archive.constants';
import { toDecimal } from '@utils/decimal.utils';
import {
  ODDS_COLUMNS,
  type MonthAggregate,
  type OddsTextRow,
} from './odds-archive.columns';
import { monthKey } from './odds-archive.plan';

/** A month's file, checked against the base. */
export type WrittenMonth = { aggregate: MonthAggregate; path: string };

type ParquetCheck = Omit<MonthAggregate, 'month'>;

const TABLE = 'month_rows';

function quote(path: string): string {
  return `'${path.replaceAll("'", "''")}'`;
}

/**
 * Writes one Parquet file (zstd) per month through a local DuckDB: rows
 * are appended as text and cast to the column types, then copied to the
 * file, then the file is read back for the checks. No DuckDB extension:
 * the rows come from Postgres through the worker's own connection and the
 * file goes to RustFS through the S3 client.
 */
export class ParquetMonthWriter {
  private appender: DuckDBAppender | null = null;
  readonly written: WrittenMonth[] = [];

  private constructor(
    private readonly instance: DuckDBInstance,
    private readonly connection: DuckDBConnection,
    private readonly dir: string,
  ) {}

  static async open(): Promise<ParquetMonthWriter> {
    const dir = await mkdtemp(join(tmpdir(), 'evcore-odds-archive-'));
    // In memory, spilling to the work directory past the limit.
    const instance = await DuckDBInstance.create(':memory:', {
      memory_limit: ODDS_ARCHIVE.DUCKDB_MEMORY_LIMIT,
      temp_directory: dir,
      threads: '2',
    });
    const connection = await instance.connect();
    return new ParquetMonthWriter(instance, connection, dir);
  }

  async startMonth(): Promise<void> {
    const columns = ODDS_COLUMNS.map(([name, type]) => `"${name}" ${type}`);
    await this.connection.run(
      `CREATE OR REPLACE TABLE ${TABLE} (${columns.join(', ')})`,
    );
    this.appender = await this.connection.createAppender(TABLE);
  }

  append(rows: readonly OddsTextRow[]): void {
    const appender = this.appender;
    if (!appender) throw new Error('append before startMonth');
    for (const row of rows) {
      for (const [name] of ODDS_COLUMNS) {
        const value = row[name];
        if (value === null) appender.appendNull();
        else appender.appendVarchar(value);
      }
      appender.endRow();
    }
    appender.flushSync();
  }

  /**
   * Writes the month's file, sorted by match so a study reading a few
   * matches skips most row groups, and checks it against the base's counts.
   */
  async endMonth(expected: MonthAggregate): Promise<void> {
    this.appender?.closeSync();
    this.appender = null;
    const path = join(this.dir, `${monthKey(expected.month)}.parquet`);
    await this.connection.run(
      `COPY (SELECT * FROM ${TABLE} ORDER BY "fixtureId", "snapshotAt")
       TO ${quote(path)} (FORMAT parquet, COMPRESSION zstd)`,
    );
    const reader = await this.connection.runAndReadAll(`
      SELECT count(*)::INTEGER AS rows,
             coalesce(sum(odds), 0)::VARCHAR AS "oddsSum",
             epoch_ms(min("snapshotAt"))::VARCHAR AS "firstAtMs",
             epoch_ms(max("snapshotAt"))::VARCHAR AS "lastAtMs"
      FROM read_parquet(${quote(path)})
    `);
    const [row] = reader.getRowObjectsJS() as ParquetCheck[];
    if (!row) throw new Error(`Empty read-back of ${path}`);
    assertSameMonth(expected, row);
    this.written.push({ aggregate: expected, path });
  }

  async close(): Promise<void> {
    this.appender?.closeSync();
    this.connection.closeSync();
    this.instance.closeSync();
    await rm(this.dir, { recursive: true, force: true });
  }
}

export function assertSameMonth(
  expected: MonthAggregate,
  file: ParquetCheck,
): void {
  const same =
    expected.rows === file.rows &&
    toDecimal(expected.oddsSum).eq(toDecimal(file.oddsSum)) &&
    expected.firstAtMs === file.firstAtMs &&
    expected.lastAtMs === file.lastAtMs;
  if (!same) {
    throw new Error(
      `Parquet of ${monthKey(expected.month)} does not match the base: ${JSON.stringify({ expected, file })}`,
    );
  }
}
