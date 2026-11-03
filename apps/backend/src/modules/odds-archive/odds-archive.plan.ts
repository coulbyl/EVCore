import { subDays } from 'date-fns';
import { ODDS_ARCHIVE, ODDS_PARTITIONS } from '@config/odds-archive.constants';

/** A partition of `odds_snapshot`, its range read from the catalog. */
export type OddsPartition = {
  name: string;
  /** Inclusive; null for MINVALUE. */
  from: Date | null;
  /** Exclusive; null for MAXVALUE. */
  to: Date | null;
  isDefault: boolean;
};

/** First instant of the month (UTC) that contains `at`. */
export function monthStart(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}

export function addMonths(month: Date, count: number): Date {
  return new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + count, 1),
  );
}

/** `2026-10`: the journal key and the Parquet file name. */
export function monthKey(month: Date): string {
  return month.toISOString().slice(0, 7);
}

export function monthPartitionName(month: Date): string {
  const [year, mm] = monthKey(month).split('-');
  return `${ODDS_PARTITIONS.MONTH_PREFIX}${year}m${mm}`;
}

export function archiveObjectKey(month: Date): string {
  return `${ODDS_ARCHIVE.KEY_PREFIX}/${monthKey(month)}.parquet`;
}

/** A bound as Postgres prints it, `'2026-11-01 00:00:00'`, read as UTC. */
function parseBoundValue(raw: string): Date | null {
  if (raw === 'MINVALUE' || raw === 'MAXVALUE') return null;
  const value =
    /^'(\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}:\d{2}(?:\.\d+)?))?'$/.exec(raw);
  if (!value) throw new Error(`Unreadable partition bound: ${raw}`);
  return new Date(`${value[1]}T${value[2] ?? '00:00:00'}Z`);
}

/** `FOR VALUES FROM (…) TO (…)` or `DEFAULT` (pg_get_expr of relpartbound). */
export function parsePartitionBound(
  name: string,
  bound: string,
): OddsPartition {
  if (bound === 'DEFAULT') {
    return { name, from: null, to: null, isDefault: true };
  }
  const range = /^FOR VALUES FROM \((.+)\) TO \((.+)\)$/.exec(bound);
  if (!range?.[1] || !range[2]) {
    throw new Error(`Unreadable partition bound for ${name}: ${bound}`);
  }
  return {
    name,
    from: parseBoundValue(range[1]),
    to: parseBoundValue(range[2]),
    isDefault: false,
  };
}

/** The month partitions that must exist: this month and the next ones. */
export function monthsToCreate(
  partitions: readonly OddsPartition[],
  now: Date,
): OddsPartition[] {
  const existing = new Set(partitions.map((p) => p.name));
  const current = monthStart(now);
  return Array.from({ length: ODDS_ARCHIVE.MONTHS_AHEAD + 1 }, (_, i) => {
    const month = addMonths(current, i);
    return {
      name: monthPartitionName(month),
      from: month,
      to: addMonths(month, 1),
      isDefault: false,
    };
  }).filter((p) => !existing.has(p.name));
}

/**
 * The partitions to archive tonight: the old table, and each month not yet
 * in the journal, once their range ended long enough ago for every match
 * priced in them to be settled. The compacted history and the default
 * partition never are.
 */
export function partitionsDue(input: {
  partitions: readonly OddsPartition[];
  archivedMonths: ReadonlySet<string>;
  now: Date;
}): OddsPartition[] {
  const closedBefore = subDays(
    input.now,
    ODDS_ARCHIVE.MONTH_CLOSED_AFTER_DAYS,
  ).getTime();
  const isDue = (p: OddsPartition): p is OddsPartition & { to: Date } => {
    if (!p.to || p.to.getTime() > closedBefore) return false;
    if (p.name === ODDS_PARTITIONS.LEGACY) return true;
    return (
      p.name.startsWith(ODDS_PARTITIONS.MONTH_PREFIX) &&
      p.from !== null &&
      !input.archivedMonths.has(monthKey(p.from))
    );
  };
  return input.partitions
    .filter(isDue)
    .sort((a, b) => a.to.getTime() - b.to.getTime());
}

/** The name the compacted partition takes in place of the archived one. */
export function compactedName(partition: OddsPartition): string {
  return partition.name === ODDS_PARTITIONS.LEGACY
    ? ODDS_PARTITIONS.HISTORY
    : partition.name;
}

/** Matches played before this instant are settled: their rows compact. */
export function settledBefore(now: Date): Date {
  return subDays(now, ODDS_ARCHIVE.FIXTURE_SETTLED_AFTER_DAYS);
}
