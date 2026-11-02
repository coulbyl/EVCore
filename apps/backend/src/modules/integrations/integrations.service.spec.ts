import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { decryptSetting, deriveSettingsKey } from '@evcore/db';
import type { AdminJournalService } from '@modules/admin-journal/admin-journal.service';
import type {
  IntegrationRow,
  IntegrationsRepository,
} from './integrations.repository';
import { IntegrationsService } from './integrations.service';

const MASTER = 'a-local-master-key-of-at-least-32-chars';

function harness(env: Record<string, string | undefined>) {
  const rows: IntegrationRow[] = [];
  const repository = {
    rows: vi.fn(() => Promise.resolve([...rows])),
    write: vi.fn((input: { key: string; value: string; secret: boolean }) => {
      const i = rows.findIndex((r) => r.key === input.key);
      const row = {
        key: input.key,
        value: input.value,
        secret: input.secret,
        updatedAt: new Date('2026-11-01T12:00:00Z'),
        updatedBy: 'Fannan',
      };
      if (i === -1) rows.push(row);
      else rows[i] = row;
      return Promise.resolve();
    }),
    remove: vi.fn((key: string) => {
      const i = rows.findIndex((r) => r.key === key);
      if (i !== -1) rows.splice(i, 1);
      return Promise.resolve();
    }),
  };
  const journal = { record: vi.fn(() => Promise.resolve()) };
  const config = { get: (name: string) => env[name] };
  const service = new IntegrationsService(
    repository as unknown as IntegrationsRepository,
    config as unknown as ConfigService,
    journal as unknown as AdminJournalService,
  );
  return { service, rows, journal };
}

describe('IntegrationsService', () => {
  it('a field without a row reads its .env variable', async () => {
    const { service } = harness({ API_FOOTBALL_KEY: 'from-env' });
    expect(await service.get('apiFootball.key')).toBe('from-env');
  });

  it('a stored secret is encrypted, then serves over the .env', async () => {
    const { service, rows } = harness({
      SETTINGS_ENCRYPTION_KEY: MASTER,
      API_FOOTBALL_KEY: 'from-env',
    });
    await service.set({
      key: 'apiFootball.key',
      value: ' stored-key ',
      actorId: 'u1',
    });
    expect(rows[0]?.value).not.toContain('stored-key');
    expect(
      decryptSetting(rows[0]?.value ?? '', deriveSettingsKey(MASTER)),
    ).toBe('stored-key');
    expect(await service.get('apiFootball.key')).toBe('stored-key');
  });

  it('never sends a secret back, only where it comes from and who set it', async () => {
    const { service } = harness({ SETTINGS_ENCRYPTION_KEY: MASTER });
    await service.set({
      key: 'email.apiKey',
      value: 're_secret',
      actorId: 'u1',
    });
    await service.set({
      key: 'email.from',
      value: 'EVCore <hi@evcore.app>',
      actorId: 'u1',
    });
    const email = (await service.list()).find((i) => i.key === 'email');
    const apiKey = email?.fields.find((f) => f.key === 'email.apiKey');
    const from = email?.fields.find((f) => f.key === 'email.from');
    expect(apiKey).toMatchObject({
      source: 'stored',
      value: null,
      updatedBy: 'Fannan',
    });
    expect(from?.value).toBe('EVCore <hi@evcore.app>');
    expect(JSON.stringify(await service.list())).not.toContain('re_secret');
  });

  it('refuses a secret without SETTINGS_ENCRYPTION_KEY; an address passes', async () => {
    const { service } = harness({});
    await expect(
      service.set({ key: 'email.apiKey', value: 're_x', actorId: 'u1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.set({ key: 'email.from', value: 'hi@evcore.app', actorId: 'u1' }),
    ).resolves.toBeUndefined();
  });

  it('journals who changed what, never the secret itself', async () => {
    const { service, journal } = harness({ SETTINGS_ENCRYPTION_KEY: MASTER });
    await service.set({
      key: 'groq.apiKey',
      value: 'gsk_secret',
      actorId: 'u1',
    });
    expect(journal.record).toHaveBeenCalledWith({
      actorId: 'u1',
      kind: 'integration_set',
      target: 'groq.apiKey',
      after: null,
    });
  });

  it('a secret written under another key is unreadable: the .env serves', async () => {
    const first = harness({ SETTINGS_ENCRYPTION_KEY: MASTER });
    await first.service.set({
      key: 'tavily.apiKey',
      value: 'tvly-old',
      actorId: 'u1',
    });
    const { service, rows } = harness({
      SETTINGS_ENCRYPTION_KEY: 'another-master-key-of-at-least-32-chars',
      TAVILY_API_KEY: 'tvly-env',
    });
    rows.push(...first.rows);
    expect(await service.get('tavily.apiKey')).toBe('tvly-env');
    const field = (await service.list())
      .find((i) => i.key === 'tavily')
      ?.fields.find((f) => f.key === 'tavily.apiKey');
    expect(field).toMatchObject({ unreadable: true, source: 'env' });
  });

  it('clearing a value gives the .env back', async () => {
    const { service } = harness({
      SETTINGS_ENCRYPTION_KEY: MASTER,
      RESEND_FROM: 'env@evcore.app',
    });
    await service.set({
      key: 'email.from',
      value: 'db@evcore.app',
      actorId: 'u1',
    });
    await service.clear({ key: 'email.from', actorId: 'u1' });
    expect(await service.get('email.from')).toBe('env@evcore.app');
  });
});
