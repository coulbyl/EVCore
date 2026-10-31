import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { AppSettingRepository } from './app-setting.repository';
import { AppSettingService } from './app-setting.service';

function harness(opts: {
  rows?: Record<string, unknown>;
  env?: Record<string, string>;
  broken?: boolean;
}) {
  const repository = {
    findValue: vi.fn((key: string) =>
      opts.broken
        ? Promise.reject(new Error('relation "app_setting" does not exist'))
        : Promise.resolve(opts.rows?.[key]),
    ),
  } as unknown as AppSettingRepository;
  const config = {
    get: vi.fn((key: string) => opts.env?.[key]),
  } as unknown as ConfigService;
  return new AppSettingService(repository, config);
}

describe('AppSettingService', () => {
  it('the row first, then the variable it replaces, then the code', async () => {
    expect(
      await harness({
        rows: { 'apiFootball.quotaAlertPct': 70 },
        env: { API_FOOTBALL_QUOTA_ALERT_PCT: '90' },
      }).quotaAlertPct(),
    ).toBe(70);
    expect(
      await harness({
        env: { API_FOOTBALL_QUOTA_ALERT_PCT: '90' },
      }).quotaAlertPct(),
    ).toBe(90);
    expect(await harness({}).quotaAlertPct()).toBe(80);
  });

  it('a malformed row is the fallback, never an error', async () => {
    expect(
      await harness({
        rows: { 'statsBackfill.dailyReserve': -5 },
      }).statsBackfillDailyReserve(),
    ).toBe(2_500);
    expect(
      await harness({
        rows: { 'scheduling.enabled': 'off' },
      }).schedulingEnabled(),
    ).toBe(true);
  });

  it('a missing table (migration not applied) answers with the fallback', async () => {
    const service = harness({
      broken: true,
      env: { STATS_BACKFILL_DAILY_RESERVE: '300' },
    });
    expect(await service.statsBackfillDailyReserve()).toBe(300);
    expect(await service.schedulingEnabled()).toBe(true);
  });

  it('the scheduled passes turned off by the row', async () => {
    expect(
      await harness({
        rows: { 'scheduling.enabled': false },
      }).schedulingEnabled(),
    ).toBe(false);
  });
});
