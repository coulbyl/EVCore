/**
 * The columns of `odds_snapshot`, in table order, with their Parquet
 * (DuckDB) type. Exported as text from Postgres, cast back by DuckDB: the
 * file keeps the exact decimals and timestamps of the base.
 */
export const ODDS_COLUMNS = [
  ['id', 'UUID'],
  ['fixtureId', 'UUID'],
  ['bookmaker', 'VARCHAR'],
  ['market', 'VARCHAR'],
  ['homeOdds', 'DECIMAL(6,3)'],
  ['drawOdds', 'DECIMAL(6,3)'],
  ['awayOdds', 'DECIMAL(6,3)'],
  ['pick', 'VARCHAR'],
  ['odds', 'DECIMAL(9,3)'],
  ['snapshotAt', 'TIMESTAMP'],
  ['createdAt', 'TIMESTAMP'],
  ['source', 'VARCHAR'],
  ['line', 'DECIMAL(5,2)'],
  ['observedAt', 'TIMESTAMP'],
] as const;

export type OddsColumn = (typeof ODDS_COLUMNS)[number][0];

/** One exported row: every column as Postgres prints it, or null. */
export type OddsTextRow = Record<OddsColumn, string | null>;

/** What a month weighs in the base, compared with what its file holds. */
export type MonthAggregate = {
  month: Date;
  rows: number;
  oddsSum: string;
  firstAtMs: string;
  lastAtMs: string;
};
