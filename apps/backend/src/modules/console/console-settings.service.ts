import { BadRequestException, Injectable } from '@nestjs/common';
import {
  APP_SETTING_DEFAULTS,
  APP_SETTING_KEYS,
  parseAppSetting,
  type AppSettingKey,
} from '@evcore/analysis-core';
import type { Prisma } from '@evcore/db';
import { AdminJournalService } from '@modules/admin-journal/admin-journal.service';
import { AppSettingRepository } from '@modules/app-setting/app-setting.repository';
import type { SettingView } from './console.types';

/**
 * Réglages (12-admin.md § 4): the five operator settings, their default,
 * who changed them. Never a secret: values only, validated by the same
 * parser the passes read with. Taken into account at the next pass.
 */
@Injectable()
export class ConsoleSettingsService {
  constructor(
    private readonly repository: AppSettingRepository,
    private readonly journal: AdminJournalService,
  ) {}

  async list(): Promise<SettingView[]> {
    const rows = new Map((await this.repository.rows()).map((r) => [r.key, r]));
    return APP_SETTING_KEYS.map((key) => {
      const row = rows.get(key);
      return {
        key,
        value: row ? parseAppSetting(key, row.value) : null,
        defaultValue:
          (APP_SETTING_DEFAULTS as Partial<Record<AppSettingKey, unknown>>)[
            key
          ] ?? null,
        updatedAt: row?.updatedAt.toISOString() ?? null,
        updatedBy: row?.updatedBy ?? null,
      };
    });
  }

  async set(input: {
    key: string;
    value: unknown;
    actorId: string;
  }): Promise<SettingView> {
    const key = APP_SETTING_KEYS.find((k) => k === input.key);
    if (!key) throw new BadRequestException('Réglage inconnu');
    const parsed = parseAppSetting(key, input.value);
    if (parsed === null) throw new BadRequestException('Valeur refusée');
    const before = (await this.list()).find((s) => s.key === key);
    await this.repository.write({
      key,
      value: parsed as Prisma.InputJsonValue,
      actorId: input.actorId,
    });
    await this.journal.record({
      actorId: input.actorId,
      kind: 'setting',
      target: key,
      before: before?.value ?? before?.defaultValue ?? null,
      after: parsed,
    });
    const after = (await this.list()).find((s) => s.key === key);
    if (!after) throw new BadRequestException('Réglage inconnu');
    return after;
  }
}
