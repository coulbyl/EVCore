import { Injectable } from '@nestjs/common';
import { Prisma } from '@evcore/db';
import { ODDS_ARCHIVE, ODDS_PARTITIONS } from '@config/odds-archive.constants';
import { PrismaService } from '@/prisma.service';
import {
  ODDS_COLUMNS,
  type MonthAggregate,
  type OddsTextRow,
} from './odds-archive.columns';
import { parsePartitionBound, type OddsPartition } from './odds-archive.plan';

/** What says a partition did not move between its export and its swap. */
export type PartitionFingerprint = { rows: number; lastTouched: Date | null };

/** Receives a partition month by month, inside the export snapshot. */
export type ArchiveSink = {
  startMonth(month: Date): Promise<void>;
  append(rows: OddsTextRow[]): void | Promise<void>;
  endMonth(aggregate: MonthAggregate): Promise<void>;
};

export type ArchivedMonthRow = {
  month: Date;
  objectKey: string;
  parquetBytes: bigint;
  rowsTotal: number;
  rowsKept: number;
  oddsSum: string;
};

export type OddsArchiveSummary = {
  /** `odds_snapshot`, every partition with its indexes. */
  tableBytes: number;
  /** Must stay 0: a price no month partition took. */
  defaultRows: number;
  months: number;
  lastMonth: Date | null;
  parquetBytes: number;
  /** Rows only in the archive now. */
  rowsArchived: number;
};

export class StaleExportError extends Error {
  constructor(partition: string) {
    super(`${partition} changed after its export; retried next night`);
  }
}

const CURSOR = 'odds_archive_export';

/** Partition names come from the catalog or from our own months. */
function ident(name: string): Prisma.Sql {
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error(`Unexpected partition name: ${name}`);
  }
  return Prisma.raw(`public."${name}"`);
}

/** A bound literal, `'2026-11-01 00:00:00.000'`, or MINVALUE / MAXVALUE. */
function boundLiteral(at: Date | null, open: 'MINVALUE' | 'MAXVALUE'): string {
  return at ? `'${at.toISOString().replace('T', ' ').replace('Z', '')}'` : open;
}

function rangeSql(partition: OddsPartition): Prisma.Sql {
  return Prisma.raw(
    `FOR VALUES FROM (${boundLiteral(partition.from, 'MINVALUE')}) TO (${boundLiteral(partition.to, 'MAXVALUE')})`,
  );
}

function boundCheckSql(partition: OddsPartition): Prisma.Sql {
  const clauses = [
    partition.from &&
      `"snapshotAt" >= ${boundLiteral(partition.from, 'MINVALUE')}`,
    partition.to && `"snapshotAt" < ${boundLiteral(partition.to, 'MAXVALUE')}`,
  ].filter(Boolean);
  return Prisma.raw(clauses.join(' AND '));
}

const TEXT_COLUMNS = Prisma.raw(
  ODDS_COLUMNS.map(([name]) => `"${name}"::text AS "${name}"`).join(', '),
);

/**
 * The partitions of `odds_snapshot` and the archive's moves on them. Raw
 * SQL throughout: partitions are not Prisma models.
 */
@Injectable()
export class OddsArchiveRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPartitions(): Promise<OddsPartition[]> {
    const rows = await this.prisma.client.$queryRaw<
      { name: string; bound: string }[]
    >`
      SELECT c.relname AS name, pg_get_expr(c.relpartbound, c.oid) AS bound
      FROM pg_inherits i
      JOIN pg_class c ON c.oid = i.inhrelid
      WHERE i.inhparent = 'public.odds_snapshot'::regclass
    `;
    return rows.map((row) => parsePartitionBound(row.name, row.bound));
  }

  async archivedMonths(): Promise<Date[]> {
    const rows = await this.prisma.client.oddsArchiveMonth.findMany({
      select: { month: true },
    });
    return rows.map((row) => row.month);
  }

  async createPartition(partition: OddsPartition): Promise<void> {
    await this.prisma.client.$transaction([
      this.prisma.client.$executeRaw`SET LOCAL lock_timeout = '10s'`,
      this.prisma.client.$executeRaw`
        CREATE TABLE IF NOT EXISTS ${ident(partition.name)}
        PARTITION OF ${ident(ODDS_PARTITIONS.PARENT)} ${rangeSql(partition)}
      `,
    ]);
  }

  async countDefaultRows(): Promise<number> {
    const [row] = await this.prisma.client.$queryRaw<{ rows: number }[]>`
      SELECT count(*)::int AS rows FROM ${ident(ODDS_PARTITIONS.DEFAULT)}
    `;
    return row?.rows ?? 0;
  }

  /**
   * Streams the partition month by month into `sink`, all inside one
   * read-only snapshot: the counts the file is checked against and the rows
   * written to it are the same rows. Returns the partition's fingerprint in
   * that snapshot.
   */
  async exportPartition(
    partition: string,
    sink: ArchiveSink,
  ): Promise<{ fingerprint: PartitionFingerprint; months: MonthAggregate[] }> {
    return this.prisma.client.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        const fingerprint = await this.fingerprintWith(tx, partition);
        const months = await tx.$queryRaw<MonthAggregate[]>`
          SELECT date_trunc('month', "snapshotAt") AS month,
                 count(*)::int AS rows,
                 coalesce(sum(odds), 0)::text AS "oddsSum",
                 (extract(epoch FROM min("snapshotAt")) * 1000)::bigint::text AS "firstAtMs",
                 (extract(epoch FROM max("snapshotAt")) * 1000)::bigint::text AS "lastAtMs"
          FROM ${ident(partition)}
          GROUP BY 1
          ORDER BY 1
        `;
        for (const aggregate of months) {
          const next = new Date(
            Date.UTC(
              aggregate.month.getUTCFullYear(),
              aggregate.month.getUTCMonth() + 1,
              1,
            ),
          );
          await sinkMonth({ tx, partition, aggregate, next, sink });
        }
        return { fingerprint, months };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: ODDS_ARCHIVE.TRANSACTION_TIMEOUT_MS,
        maxWait: 60_000,
      },
    );
  }

  /**
   * Builds `compact`, a standalone copy of the rows the app still reads
   * (ODDS-ARCHIVE.md § 3), with the partition's keys, indexes and a bound
   * check so that attaching it reads nothing. Returns the kept rows by
   * month. A leftover from a failed night is dropped first.
   */
  async buildCompact(input: {
    partition: OddsPartition;
    compact: string;
    settledBefore: Date;
  }): Promise<Map<string, number>> {
    const source = ident(input.partition.name);
    const compact = ident(input.compact);
    const db = this.prisma.client;
    await db.$executeRaw`DROP TABLE IF EXISTS ${compact}`;
    await db.$executeRaw`
      CREATE TABLE ${compact} (LIKE ${ident(ODDS_PARTITIONS.PARENT)} INCLUDING DEFAULTS)
    `;
    // Kept: every non-PREMATCH row; every row of a match not settled yet;
    // per price, the closing line by observation (odds_closing_line), the
    // last by snapshotAt (odds_latest and the history readers), the opening
    // (odds_opening_line); per coupon leg, the price known at its
    // publication for every pick of its market (priceUnpricedLegs reads the
    // sibling picks for the margin). Each is the arg-max of its reader over
    // a subset of the partition, so the reader still finds the same row.
    await db.$executeRaw`
      WITH scope AS MATERIALIZED (
        SELECT o.id, o."snapshotAt", o."fixtureId", o.bookmaker, o.market,
               o.pick, o.line, o.source, o."createdAt", o."observedAt",
               coalesce(o."observedAt", o."createdAt") AS seen,
               f."scheduledAt"
        FROM ${source} o
        JOIN public.fixture f ON f.id = o."fixtureId"
      ),
      prematch AS (
        SELECT * FROM scope
        WHERE source = 'PREMATCH' AND "scheduledAt" < ${input.settledBefore}
      ),
      anchors AS (
        SELECT DISTINCT l."fixtureId", l.market, p."generatedAt"
        FROM public.coupon_proposal_leg l
        JOIN public.coupon_proposal p ON p.id = l."couponProposalId"
        WHERE l."fixtureId" IN (SELECT DISTINCT "fixtureId" FROM prematch)
      ),
      kept AS (
        SELECT id, "snapshotAt" FROM scope
        WHERE source <> 'PREMATCH' OR "scheduledAt" >= ${input.settledBefore}
        UNION
        (SELECT DISTINCT ON ("fixtureId", bookmaker, market, pick, line)
                id, "snapshotAt"
         FROM prematch
         WHERE "snapshotAt" < "scheduledAt" AND seen < "scheduledAt"
         ORDER BY "fixtureId", bookmaker, market, pick, line,
                  seen DESC, "snapshotAt" DESC, id DESC)
        UNION
        (SELECT DISTINCT ON ("fixtureId", bookmaker, market, pick, line)
                id, "snapshotAt"
         FROM prematch
         WHERE "snapshotAt" <= "scheduledAt"
         ORDER BY "fixtureId", bookmaker, market, pick, line,
                  "snapshotAt" DESC, id DESC)
        UNION
        (SELECT DISTINCT ON ("fixtureId", bookmaker, market, pick, line)
                id, "snapshotAt"
         FROM prematch
         WHERE "snapshotAt" < "scheduledAt" AND "createdAt" < "scheduledAt"
         ORDER BY "fixtureId", bookmaker, market, pick, line,
                  "createdAt" ASC, "snapshotAt" ASC, id ASC)
        UNION
        (SELECT DISTINCT ON (s."fixtureId", s.market, s.pick, s.line,
                             s.bookmaker, a."generatedAt")
                s.id, s."snapshotAt"
         FROM anchors a
         JOIN prematch s ON s."fixtureId" = a."fixtureId" AND s.market = a.market
         WHERE s."snapshotAt" <= s."scheduledAt"
           AND coalesce(s."observedAt", s."snapshotAt") <= a."generatedAt"
         ORDER BY s."fixtureId", s.market, s.pick, s.line, s.bookmaker,
                  a."generatedAt", s."snapshotAt" DESC)
      )
      INSERT INTO ${compact}
      SELECT o.* FROM ${source} o
      JOIN kept k ON k.id = o.id AND k."snapshotAt" = o."snapshotAt"
    `;
    await db.$executeRaw`ALTER TABLE ${compact} ADD PRIMARY KEY ("id", "snapshotAt")`;
    await db.$executeRaw`
      ALTER TABLE ${compact} ADD UNIQUE NULLS NOT DISTINCT
        ("fixtureId", "bookmaker", "market", "pick", "line", "snapshotAt")
    `;
    await db.$executeRaw`CREATE INDEX ON ${compact} ("fixtureId", "snapshotAt")`;
    await db.$executeRaw`CREATE INDEX ON ${compact} ("snapshotAt")`;
    await db.$executeRaw`
      ALTER TABLE ${compact} ADD FOREIGN KEY ("fixtureId")
        REFERENCES public.fixture(id) ON DELETE RESTRICT ON UPDATE CASCADE
    `;
    await db.$executeRaw`
      ALTER TABLE ${compact} ADD CONSTRAINT ${Prisma.raw(`"${input.compact}_bound"`)}
        CHECK (${boundCheckSql(input.partition)})
    `;
    await db.$executeRaw`ANALYZE ${compact}`;
    const kept = await db.$queryRaw<{ month: Date; rows: number }[]>`
      SELECT date_trunc('month', "snapshotAt") AS month, count(*)::int AS rows
      FROM ${compact} GROUP BY 1
    `;
    return new Map(
      kept.map((row) => [row.month.toISOString().slice(0, 7), row.rows]),
    );
  }

  /**
   * Replaces the partition by its compacted copy, in one short transaction
   * that first checks nothing was written to it since its export: the
   * table is locked for the swap only (seconds), the old partition's space
   * returns at commit, the journal is written with it.
   */
  async swap(input: {
    partition: OddsPartition;
    compact: string;
    target: string;
    expected: PartitionFingerprint;
    journal: ArchivedMonthRow[];
  }): Promise<void> {
    const parent = ident(ODDS_PARTITIONS.PARENT);
    await this.prisma.client.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET LOCAL lock_timeout = ${Prisma.raw(`'${ODDS_ARCHIVE.SWAP_LOCK_TIMEOUT}'`)}`;
        // Parent first, partitions with it: the order every writer takes.
        await tx.$executeRaw`LOCK TABLE ${parent} IN ACCESS EXCLUSIVE MODE`;
        const now = await this.fingerprintWith(tx, input.partition.name);
        if (
          now.rows !== input.expected.rows ||
          now.lastTouched?.getTime() !== input.expected.lastTouched?.getTime()
        ) {
          throw new StaleExportError(input.partition.name);
        }
        await tx.$executeRaw`ALTER TABLE ${parent} DETACH PARTITION ${ident(input.partition.name)}`;
        await tx.$executeRaw`DROP TABLE ${ident(input.partition.name)}`;
        await tx.$executeRaw`ALTER TABLE ${ident(input.compact)} RENAME TO ${Prisma.raw(`"${input.target}"`)}`;
        await tx.$executeRaw`
          ALTER TABLE ${parent} ATTACH PARTITION ${ident(input.target)} ${rangeSql(input.partition)}
        `;
        await tx.$executeRaw`
          ALTER TABLE ${ident(input.target)} DROP CONSTRAINT ${Prisma.raw(`"${input.compact}_bound"`)}
        `;
        await tx.oddsArchiveMonth.createMany({
          data: input.journal.map((row) => ({
            ...row,
            oddsSum: new Prisma.Decimal(row.oddsSum),
          })),
        });
      },
      { timeout: ODDS_ARCHIVE.TRANSACTION_TIMEOUT_MS, maxWait: 60_000 },
    );
  }

  /** For the console: the base table's size and the archive's. */
  async summary(): Promise<OddsArchiveSummary> {
    const [size] = await this.prisma.client.$queryRaw<{ bytes: bigint }[]>`
      SELECT coalesce(sum(pg_total_relation_size(i.inhrelid)), 0)::bigint AS bytes
      FROM pg_inherits i
      WHERE i.inhparent = 'public.odds_snapshot'::regclass
    `;
    const [journal, defaultRows] = await Promise.all([
      this.prisma.client.oddsArchiveMonth.aggregate({
        _count: { _all: true },
        _max: { month: true },
        _sum: { parquetBytes: true, rowsTotal: true, rowsKept: true },
      }),
      this.countDefaultRows(),
    ]);
    return {
      tableBytes: Number(size?.bytes ?? 0n),
      defaultRows,
      months: journal._count._all,
      lastMonth: journal._max.month,
      parquetBytes: Number(journal._sum.parquetBytes ?? 0n),
      rowsArchived:
        (journal._sum.rowsTotal ?? 0) - (journal._sum.rowsKept ?? 0),
    };
  }

  private async fingerprintWith(
    tx: Prisma.TransactionClient,
    partition: string,
  ): Promise<PartitionFingerprint> {
    const [row] = await tx.$queryRaw<PartitionFingerprint[]>`
      SELECT count(*)::int AS rows,
             max(coalesce("observedAt", "createdAt")) AS "lastTouched"
      FROM ${ident(partition)}
    `;
    return row ?? { rows: 0, lastTouched: null };
  }
}

/** One month through a server-side cursor, `FETCH_ROWS` at a time. */
async function sinkMonth(input: {
  tx: Prisma.TransactionClient;
  partition: string;
  aggregate: MonthAggregate;
  next: Date;
  sink: ArchiveSink;
}): Promise<void> {
  const { tx, sink } = input;
  await sink.startMonth(input.aggregate.month);
  await tx.$executeRaw`
    DECLARE ${Prisma.raw(CURSOR)} NO SCROLL CURSOR FOR
    SELECT ${TEXT_COLUMNS} FROM ${ident(input.partition)}
    WHERE "snapshotAt" >= ${input.aggregate.month}
      AND "snapshotAt" < ${input.next}
  `;
  for (;;) {
    const rows = await tx.$queryRawUnsafe<OddsTextRow[]>(
      `FETCH ${ODDS_ARCHIVE.FETCH_ROWS} FROM ${CURSOR}`,
    );
    if (rows.length === 0) break;
    await sink.append(rows);
  }
  await tx.$executeRaw`CLOSE ${Prisma.raw(CURSOR)}`;
  await sink.endMonth(input.aggregate);
}
