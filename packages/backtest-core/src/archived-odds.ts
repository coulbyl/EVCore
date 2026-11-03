import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import type { RawOddsRow } from "@evcore/analysis-core";

// The odds the base no longer holds (docs/audits/2026-11-03/ODDS-ARCHIVE.md):
// each closed month of `odds_snapshot` is a Parquet file with every row it
// had, while the base keeps only the closing, opening and latest prices.
// A replay that reads a price at an instant before the close needs the
// archive; PointInTimeLoader merges both, by row id.

/** A row as the archive holds it, enough for the point-in-time readers. */
export type ArchivedOddsRow = RawOddsRow & {
  id: string;
  fixtureId: string;
  createdAt: Date;
};

export type ArchivedOddsSource = {
  /** `before`: only rows captured and priced before it. */
  rowsFor(
    fixtureIds: readonly string[],
    before?: Date,
  ): Promise<ArchivedOddsRow[]>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fixtures per query: an IN list this long stays cheap for DuckDB. */
const FIXTURES_PER_QUERY = 500;

type ArchiveQueryRow = Omit<ArchivedOddsRow, "snapshotAt" | "createdAt"> & {
  snapshotAt: number;
  createdAt: number;
};

/**
 * Reads the archive's Parquet files from a local directory (copied from
 * the `evcore-odds-archive` bucket, docs/exploitation.md), through DuckDB.
 * The files are sorted by match: a query on a few matches skips most row
 * groups. Decimals come back as text, timestamps as UTC dates.
 */
export class DuckDbOddsArchive implements ArchivedOddsSource {
  private constructor(
    private readonly instance: DuckDBInstance,
    private readonly connection: DuckDBConnection,
    private readonly glob: string,
  ) {}

  static async open(dir: string): Promise<DuckDbOddsArchive> {
    const instance = await DuckDBInstance.create(":memory:");
    const connection = await instance.connect();
    const glob = `${dir.replace(/\/$/, "")}/*.parquet`.replaceAll("'", "''");
    return new DuckDbOddsArchive(instance, connection, glob);
  }

  async rowsFor(
    fixtureIds: readonly string[],
    before?: Date,
  ): Promise<ArchivedOddsRow[]> {
    const ids = [...new Set(fixtureIds)];
    if (ids.some((id) => !UUID.test(id))) {
      throw new Error("rowsFor expects fixture UUIDs");
    }
    const bound = before
      ? `AND "createdAt" < epoch_ms(${before.getTime()}) AND "snapshotAt" < epoch_ms(${before.getTime()})`
      : "";
    const out: ArchivedOddsRow[] = [];
    for (let i = 0; i < ids.length; i += FIXTURES_PER_QUERY) {
      const chunk = ids.slice(i, i + FIXTURES_PER_QUERY);
      const reader = await this.connection.runAndReadAll(`
        SELECT id::VARCHAR AS id, "fixtureId"::VARCHAR AS "fixtureId",
               bookmaker, market, pick,
               odds::VARCHAR AS odds, "homeOdds"::VARCHAR AS "homeOdds",
               "drawOdds"::VARCHAR AS "drawOdds", "awayOdds"::VARCHAR AS "awayOdds",
               epoch_ms("snapshotAt") AS "snapshotAt",
               epoch_ms("createdAt") AS "createdAt"
        FROM read_parquet('${this.glob}')
        WHERE "fixtureId" IN (${chunk.map((id) => `'${id}'::UUID`).join(", ")})
        ${bound}
      `);
      for (const row of reader.getRowObjectsJS() as ArchiveQueryRow[]) {
        out.push({
          ...row,
          snapshotAt: new Date(Number(row.snapshotAt)),
          createdAt: new Date(Number(row.createdAt)),
        });
      }
    }
    return out;
  }

  close(): void {
    this.connection.closeSync();
    this.instance.closeSync();
  }
}

/**
 * The base's rows plus the archive's, each row once (the kept rows of an
 * archived month are in both).
 */
export function mergeArchivedRows<T extends { id: string }>(
  base: readonly T[],
  archived: readonly T[],
): T[] {
  const seen = new Set(base.map((row) => row.id));
  return [...base, ...archived.filter((row) => !seen.has(row.id))];
}
