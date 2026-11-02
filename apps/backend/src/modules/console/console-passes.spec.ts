import { describe, expect, it } from 'vitest';
import { CONSOLE_PASSES } from '@config/console.constants';
import { ETL_CRON_SCHEDULES } from '@config/etl.constants';
import { SLIP_DIGEST } from '@config/slip-digest.constants';
import { COUPON_SCHEDULE } from '@evcore/analysis-core';
import { passesOf, type PassJob } from './console-passes';

const at = (time: string) => new Date(`2026-11-01T${time}:00.000Z`).getTime();
const job = (over: Partial<PassJob> & { name: string }): PassJob => ({
  state: 'completed',
  createdAt: at('06:00'),
  startedAt: at('06:00'),
  finishedAt: at('06:01'),
  failedReason: null,
  ...over,
});
const view = (now: string, jobs: Record<string, PassJob[]>) =>
  passesOf({
    now: new Date(`2026-11-01T${now}:00.000Z`),
    jobs: new Map(Object.entries(jobs)),
  });

describe('CONSOLE_PASSES', () => {
  it('each time agrees with the cron the pass runs on', () => {
    const hourOf = (key: string) =>
      CONSOLE_PASSES.find((p) => p.key === key)?.at.hour;
    expect(ETL_CRON_SCHEDULES.STATS_SYNC).toBe(`0 ${hourOf('stats')} * * *`);
    expect(ETL_CRON_SCHEDULES.ODDS_PREMATCH_SYNC).toBe(
      `0 ${hourOf('odds_morning')},${hourOf('odds_evening')} * * *`,
    );
    expect(SLIP_DIGEST.CRON).toBe(`0 ${hourOf('morning_brief')} * * *`);
    expect(COUPON_SCHEDULE.HORIZON_PASS_CRON).toBe(
      `0 ${hourOf('coupons')} * * *`,
    );
    expect(COUPON_SCHEDULE.LLM_COUPON_CRON).toBe(
      `45 ${hourOf('ai_combo')} * * *`,
    );
    expect(ETL_CRON_SCHEDULES.BETTING_ENGINE_ANALYSIS).toBe(
      `0 ${hourOf('analysis')} * * *`,
    );
  });
});

describe('passesOf', () => {
  it('the morning and evening odds share a queue, split at 19:00', () => {
    const passes = view('20:00', {
      'odds-prematch-sync': [
        job({ name: 'odds-prematch-sync' }),
        job({
          name: 'odds-prematch-sync',
          createdAt: at('19:00'),
          state: 'active',
          startedAt: at('19:02'),
          finishedAt: null,
        }),
      ],
    });
    expect(passes.find((p) => p.key === 'odds_morning')).toMatchObject({
      state: 'done',
      canRelaunch: false,
    });
    expect(passes.find((p) => p.key === 'odds_evening')).toMatchObject({
      state: 'running',
      runningSince: '2026-11-01T19:02:00.000Z',
      canRelaunch: false,
    });
  });

  it('stats count one job per league; a failure says the queue message', () => {
    const passes = view('09:00', {
      'league-sync': [
        job({ name: 'stats-sync-PL-2026', createdAt: at('04:00') }),
        job({
          name: 'stats-sync-BL1-2026',
          createdAt: at('04:00'),
          state: 'failed',
          failedReason: 'quota',
        }),
        job({ name: 'fixtures-sync-PL-2026', createdAt: at('04:00') }),
      ],
    });
    expect(passes[0]).toMatchObject({
      key: 'stats',
      state: 'failed',
      jobs: 2,
      failed: 1,
      reason: 'quota',
      canRelaunch: true,
    });
  });

  it('waiting before its time, missed after it with nothing, never the brief', () => {
    const passes = view('18:30', {});
    expect(passes.find((p) => p.key === 'analysis')).toMatchObject({
      state: 'waiting',
      canRelaunch: true,
    });
    expect(passes.find((p) => p.key === 'coupons')).toMatchObject({
      state: 'missed',
    });
    expect(passes.find((p) => p.key === 'morning_brief')).toMatchObject({
      state: 'missed',
      canRelaunch: false,
    });
  });
});
