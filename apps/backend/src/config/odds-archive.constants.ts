/**
 * Archive of `odds_snapshot` (docs/audits/2026-11-03/ODDS-ARCHIVE.md): each
 * closed month goes whole to Parquet on RustFS, then its partition is
 * compacted to the rows the app still reads. Decisions in code (ENV-PROD
 * § 6), never in the .env.
 */
export const ODDS_ARCHIVE = {
  QUEUE: 'odds-archive',
  SCHEDULER_KEY: 'odds-archive-nightly',
  JOB: 'odds-archive',
  // 03:30 UTC: after the evening passes, before the morning digest. Daily:
  // a month is archived the first night it is ready, a failed night retries
  // the next.
  CRON: '30 3 * * *',
  // A month is archived once every match priced in it is played and settled:
  // a price is taken at most ~10 days ahead, settlement and CLV run on match
  // day. Rows of a match not yet played this many days ago are kept whole
  // (a postponed match, a far-ahead price).
  MONTH_CLOSED_AFTER_DAYS: 14,
  FIXTURE_SETTLED_AFTER_DAYS: 7,
  // Partitions created ahead, so a price never lands in the default one.
  MONTHS_AHEAD: 2,
  BUCKET: 'evcore-odds-archive',
  KEY_PREFIX: 'odds_snapshot',
  // Rows read per FETCH while exporting (~14 text columns each).
  FETCH_ROWS: 20_000,
  // DuckDB stays small beside the worker: it spills to disk past this.
  DUCKDB_MEMORY_LIMIT: '512MB',
  DUCKDB_THREADS: '2',
  // The swap waits this long for the table, else retries the next night;
  // creating a month ahead, this long.
  SWAP_LOCK_TIMEOUT: '30s',
  CREATE_LOCK_TIMEOUT: '10s',
  // A transaction waits this long for a pool connection.
  TRANSACTION_MAX_WAIT_MS: 60_000,
  // The default partition is counted up to here: it must stay empty.
  DEFAULT_ROWS_COUNT_CAP: 100_000,
  // Holding the export snapshot for a large month (the legacy partition is
  // 25 M rows) takes minutes.
  TRANSACTION_TIMEOUT_MS: 60 * 60_000,
} as const;

/**
 * The partitions the migration 20261103120000 laid out: the old table holds
 * everything before November 2026 until its compacted version replaces it.
 */
export const ODDS_PARTITIONS = {
  PARENT: 'odds_snapshot',
  LEGACY: 'odds_snapshot_legacy',
  HISTORY: 'odds_snapshot_history',
  DEFAULT: 'odds_snapshot_default',
  MONTH_PREFIX: 'odds_snapshot_y',
} as const;
