import {
  CONSOLE_PASSES,
  CONSOLE_PASS_GRACE_MINUTES,
  type ConsolePassKey,
} from '@config/console.constants';

const MINUTE_MS = 60 * 1000;

/** The part of a job a pass needs. */
export type PassJob = {
  name: string;
  state: 'completed' | 'failed' | 'active';
  /** When it was added. */
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  failedReason: string | null;
};

export type PassState = 'done' | 'failed' | 'running' | 'waiting' | 'missed';

/** A line of « Les passes d'aujourd'hui ». */
export type PassView = {
  key: ConsolePassKey;
  /** « 17:00 » UTC, as scheduled. */
  at: string;
  state: PassState;
  /** Last finished job, ISO. */
  lastAt: string | null;
  /** Running: since when, ISO. */
  runningSince: string | null;
  /** Jobs of the window: one, or one per league for the stats. */
  jobs: number;
  failed: number;
  /** The queue's own message for the last failure, nothing more. */
  reason: string | null;
  canRelaunch: boolean;
};

const pad = (n: number) => String(n).padStart(2, '0');

function matches(job: PassJob, pattern: { name: string } | { prefix: string }) {
  return 'name' in pattern
    ? job.name === pattern.name
    : job.name.startsWith(pattern.prefix);
}

/**
 * Each pass of the day from the jobs of its queue (12-admin.md § 1, § 5).
 * A pass owns the jobs added from the start of the day — or, for a job
 * name run twice a day (the odds), from the earlier run's time — until the
 * next run of the same name. A relaunch before the time counts for it.
 */
export function passesOf(input: {
  now: Date;
  jobs: ReadonlyMap<string, readonly PassJob[]>;
}): PassView[] {
  const { now } = input;
  const dayStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const timeOf = (p: (typeof CONSOLE_PASSES)[number]) =>
    dayStart + (p.at.hour * 60 + p.at.minute) * MINUTE_MS;

  return CONSOLE_PASSES.map((pass) => {
    const sameJob = CONSOLE_PASSES.filter(
      (other) =>
        other.queue === pass.queue &&
        JSON.stringify(other.job) === JSON.stringify(pass.job),
    );
    const index = sameJob.indexOf(pass);
    const from = index === 0 ? dayStart : timeOf(pass);
    const next = sameJob[index + 1];
    const to = next ? timeOf(next) : dayStart + 24 * 60 * MINUTE_MS;

    const jobs = (input.jobs.get(pass.queue) ?? []).filter(
      (job) =>
        matches(job, pass.job) && job.createdAt >= from && job.createdAt < to,
    );
    const running = jobs.filter((job) => job.state === 'active');
    const failed = jobs.filter((job) => job.state === 'failed');
    const finished = jobs
      .map((job) => job.finishedAt)
      .filter((at): at is number => at !== null);
    const lastFailed = [...failed].sort(
      (a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0),
    )[0];

    let state: PassState;
    if (running.length > 0) state = 'running';
    else if (failed.length > 0) state = 'failed';
    else if (jobs.length > 0) state = 'done';
    else if (
      now.getTime() <
      timeOf(pass) + CONSOLE_PASS_GRACE_MINUTES * MINUTE_MS
    )
      state = 'waiting';
    else state = 'missed';

    const since = running
      .map((job) => job.startedAt ?? job.createdAt)
      .sort((a, b) => a - b)[0];
    return {
      key: pass.key,
      at: `${pad(pass.at.hour)}:${pad(pass.at.minute)}`,
      state,
      lastAt:
        finished.length > 0
          ? new Date(Math.max(...finished)).toISOString()
          : null,
      runningSince: since !== undefined ? new Date(since).toISOString() : null,
      jobs: jobs.length,
      failed: failed.length,
      reason: lastFailed?.failedReason ?? null,
      // Relancer on a pass failed, missed or waiting; never twice at once.
      canRelaunch: pass.relaunch && state !== 'running' && state !== 'done',
    };
  });
}
