import { CONSOLE_RULES as R } from '@config/console.constants';
import { formatDateUtc } from '@utils/date.utils';
import type {
  ConsoleSignals,
  ConsoleStatus,
  LightKey,
  LightState,
  TodoItem,
} from './console.types';

const HOUR_MS = 60 * 60 * 1000;

/** Whole hours since `at`, or null when it never happened. */
function hoursSince(at: Date | null, now: Date): number | null {
  return at ? Math.floor((now.getTime() - at.getTime()) / HOUR_MS) : null;
}

/** Older than `hours`, or never: both count as stale. */
function staleFor(at: Date | null, now: Date, hours: number): boolean {
  return at === null || now.getTime() - at.getTime() > hours * HOUR_MS;
}

/**
 * The three lights and « À faire » from the signals (12-admin.md § 1). One
 * function, no I/O: the table of the spec, line by line. A light is the
 * worst of its lines; a line disappears when its cause does.
 */
export function consoleStatusOf(s: ConsoleSignals): ConsoleStatus {
  const todo: TodoItem[] = [];
  const { now } = s;

  // Data
  if (staleFor(s.lastOddsAt, now, R.ODDS_STALE_HOURS)) {
    todo.push({
      kind: 'odds_stale',
      light: 'data',
      severity: 'red',
      hours: hoursSince(s.lastOddsAt, now),
    });
  }
  if (s.etlFailures.quotaBody) {
    todo.push({
      kind: 'quota',
      light: 'data',
      severity: 'red',
      detail: s.etlFailures.quotaBody,
    });
  }
  const otherFailures = s.etlFailures.count - (s.etlFailures.quotaBody ? 1 : 0);
  if (otherFailures > 0) {
    todo.push({
      kind: 'etl_failed',
      light: 'data',
      severity: 'red',
      count: otherFailures,
      last: s.etlFailures.lastBody ?? '',
    });
  }
  if (s.statsLate.fixtures > 0) {
    todo.push({
      kind: 'stats_late',
      light: 'data',
      severity: 'orange',
      ...s.statsLate,
    });
  }

  // Engine
  const deadline = new Date(now);
  deadline.setUTCHours(
    R.COUPONS_DEADLINE_UTC.hour,
    R.COUPONS_DEADLINE_UTC.minute,
    0,
    0,
  );
  if (now >= deadline && s.tomorrowCoupons === 0) {
    todo.push({
      kind: 'coupons_missing',
      light: 'engine',
      severity: 'red',
      forDate: formatDateUtc(new Date(now.getTime() + 24 * HOUR_MS)),
    });
  }
  if (staleFor(s.lastAnalysisAt, now, R.ANALYSIS_STALE_HOURS)) {
    todo.push({
      kind: 'analysis_stopped',
      light: 'engine',
      severity: 'red',
      hours: hoursSince(s.lastAnalysisAt, now),
    });
  }
  for (const absence of s.absences) {
    if (absence.days >= R.PRODUCT_ABSENT_DAYS || absence.today) {
      todo.push({
        kind: 'product_absent',
        light: 'engine',
        severity: 'orange',
        product: absence.product,
        days: absence.days,
        window: R.PRODUCT_ABSENT_WINDOW_DAYS,
      });
    }
  }
  for (const suspension of s.suspendedMarkets) {
    todo.push({
      kind: 'market_suspended',
      light: 'engine',
      severity: 'orange',
      market: suspension.market,
      since: formatDateUtc(suspension.since),
    });
  }
  if (staleFor(s.lastAiAt, now, R.AI_STALE_HOURS)) {
    todo.push({
      kind: 'ai_silent',
      light: 'engine',
      severity: 'orange',
      hours: hoursSince(s.lastAiAt, now),
    });
  }

  // Players
  if (staleFor(s.lastPlayerSeenAt, now, R.PLAYERS_SILENT_HOURS)) {
    todo.push({
      kind: 'players_silent',
      light: 'players',
      severity: 'red',
      hours: hoursSince(s.lastPlayerSeenAt, now),
    });
  }
  if (s.unansweredMessages > 0) {
    todo.push({
      kind: 'support_unanswered',
      light: 'players',
      severity: 'orange',
      count: s.unansweredMessages,
    });
  }

  const lightOf = (key: LightKey): LightState => {
    const lines = todo.filter((item) => item.light === key);
    if (lines.some((item) => item.severity === 'red')) return 'red';
    return lines.length > 0 ? 'orange' : 'green';
  };
  return {
    at: now.toISOString(),
    lights: {
      data: lightOf('data'),
      engine: lightOf('engine'),
      players: lightOf('players'),
    },
    // Reds first, then in the order of the lights.
    todo: [...todo].sort((a, b) =>
      a.severity === b.severity ? 0 : a.severity === 'red' ? -1 : 1,
    ),
  };
}
