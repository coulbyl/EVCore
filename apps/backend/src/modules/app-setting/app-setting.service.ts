import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  APP_SETTING_DEFAULTS,
  parseAppSetting,
  type AppSettingKey,
  type AppSettings,
} from '@evcore/analysis-core';
import { createLogger } from '@utils/logger';
import { statsBackfillDailyReserve } from '@modules/etl/stats-backfill.plan';
import { AppSettingRepository } from './app-setting.repository';

const logger = createLogger('app-setting');

/**
 * The operator switches (12-admin § 4), read on every pass — no cache: a
 * change is taken at the next pass. The order of truth:
 *
 * 1. the `app_setting` row, when written and well formed;
 * 2. the environment variable it replaces, for the transition (ENV-PROD
 *    § 6): a deploy changes no behaviour until the row is written;
 * 3. the default in code.
 *
 * A missing table (migration not applied yet) or an unreadable row is
 * logged and never stops a pass: the next source answers.
 */
@Injectable()
export class AppSettingService {
  constructor(
    private readonly repository: AppSettingRepository,
    private readonly config: ConfigService,
  ) {}

  async quotaAlertPct(): Promise<number> {
    const stored = await this.read('apiFootball.quotaAlertPct');
    if (stored !== null) return stored;
    const fromEnv = Number(
      this.config.get<string>('API_FOOTBALL_QUOTA_ALERT_PCT'),
    );
    return Number.isInteger(fromEnv) && fromEnv >= 1 && fromEnv <= 100
      ? fromEnv
      : APP_SETTING_DEFAULTS['apiFootball.quotaAlertPct'];
  }

  async statsBackfillDailyReserve(): Promise<number> {
    const stored = await this.read('statsBackfill.dailyReserve');
    // The env reader already falls back on the code default.
    return stored ?? statsBackfillDailyReserve(this.config);
  }

  async schedulingEnabled(): Promise<boolean> {
    return (
      (await this.read('scheduling.enabled')) ??
      APP_SETTING_DEFAULTS['scheduling.enabled']
    );
  }

  private async read<K extends AppSettingKey>(
    key: K,
  ): Promise<AppSettings[K] | null> {
    let raw: unknown;
    try {
      raw = await this.repository.findValue(key);
    } catch (err) {
      logger.warn({ err, key }, 'app_setting unreadable, using the fallback');
      return null;
    }
    if (raw === undefined) return null;
    const value = parseAppSetting(key, raw);
    if (value === null) {
      logger.warn({ key, raw }, 'app_setting malformed, using the fallback');
    }
    return value;
  }
}
