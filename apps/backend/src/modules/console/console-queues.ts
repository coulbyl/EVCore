import {
  CONSOLE_QUEUES,
  CONSOLE_RULES as R,
  type ConsoleQueueKey,
} from '@config/console.constants';

const HOUR_MS = 60 * 60 * 1000;

export type QueueState =
  | 'failed'
  | 'running'
  | 'on_time'
  | 'paused'
  | 'on_demand';

/** What a queue holds, read once (no I/O here). */
export type QueueReading = {
  key: ConsoleQueueKey;
  paused: boolean;
  /** Failed jobs still in the queue: an « Effacer » removes them. */
  failed: { finishedAt: number | null; reason: string | null }[];
  /** Active or waiting: started (or queued) at. */
  running: { since: number }[];
  lastDoneAt: number | null;
  nextAt: number | null;
};

export type QueueView = {
  key: ConsoleQueueKey;
  state: QueueState;
  lastDoneAt: string | null;
  nextAt: string | null;
  runningSince: string | null;
  failure: { count: number; at: string | null; reason: string | null } | null;
};

const iso = (ms: number | null) =>
  ms === null ? null : new Date(ms).toISOString();

/**
 * One queue's line (exploitation-inventaire.md): failed while a failure of
 * the last ETL_FAILURE_HOURS is still in it and no run succeeded since
 * (« Effacer » acknowledges it), then running, paused, on demand, on time.
 */
export function queueViewOf(reading: QueueReading, now: Date): QueueView {
  const since = now.getTime() - R.ETL_FAILURE_HOURS * HOUR_MS;
  const failures = reading.failed
    .filter(
      (job) =>
        (job.finishedAt ?? 0) >= since &&
        (job.finishedAt ?? 0) > (reading.lastDoneAt ?? 0),
    )
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));
  const kind = CONSOLE_QUEUES.find((q) => q.key === reading.key)?.kind;
  const firstRun = reading.running.reduce<number | null>(
    (min, job) => (min === null || job.since < min ? job.since : min),
    null,
  );

  let state: QueueState;
  if (failures.length > 0) state = 'failed';
  else if (firstRun !== null) state = 'running';
  else if (reading.paused) state = 'paused';
  else if (kind === 'on_demand') state = 'on_demand';
  else state = 'on_time';

  return {
    key: reading.key,
    state,
    lastDoneAt: iso(reading.lastDoneAt),
    nextAt: iso(reading.nextAt),
    runningSince: iso(firstRun),
    failure:
      failures.length > 0
        ? {
            count: failures.length,
            at: iso(failures[0]?.finishedAt ?? null),
            reason: failures[0]?.reason ?? null,
          }
        : null,
  };
}

const RANK: Record<QueueState, number> = {
  failed: 0,
  running: 1,
  on_time: 2,
  paused: 3,
  on_demand: 4,
};

/**
 * The list in the order one reads it: failures, what runs, then the
 * scheduled ones by their next run, the paused, the ones run by hand. The
 * lights' own watch shows only while it fails.
 */
export function queueListOf(readings: QueueReading[], now: Date): QueueView[] {
  const order = new Map<string, number>(
    CONSOLE_QUEUES.map((q, index) => [q.key, index]),
  );
  return readings
    .map((reading) => queueViewOf(reading, now))
    .filter((view) => view.key !== 'watch' || view.state === 'failed')
    .sort(
      (a, b) =>
        RANK[a.state] - RANK[b.state] ||
        (a.nextAt && b.nextAt
          ? Date.parse(a.nextAt) - Date.parse(b.nextAt)
          : 0) ||
        (a.nextAt ? -1 : b.nextAt ? 1 : 0) ||
        (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0),
    );
}
