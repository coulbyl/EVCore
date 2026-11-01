import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  INTEGRATIONS,
  deriveSettingsKey,
  encryptSetting,
  integrationFieldOf,
  readIntegrationRows,
} from '@evcore/db';
import { AdminJournalService } from '@modules/admin-journal/admin-journal.service';
import { createLogger } from '@utils/logger';
import {
  IntegrationsRepository,
  type IntegrationRow,
} from './integrations.repository';
import type { IntegrationView } from './integrations.types';

const logger = createLogger('integrations');

/** A changed key is read again by every service within this delay. */
const CACHE_MS = 60_000;

/**
 * Réglages › Intégrations (revue admin du 01/11): the third-party services'
 * keys and addresses, read from `integration_setting` (a secret decrypted
 * with SETTINGS_ENCRYPTION_KEY), else from the environment variable they
 * replace. Read again at most every minute, so a key changed on the screen
 * serves without a redeploy. A secret is never sent back: the screen only
 * learns that it is set, where from, and by whom.
 */
@Injectable()
export class IntegrationsService {
  private readonly key: Buffer | null;
  private cache: { at: number; values: Promise<Map<string, string>> } | null =
    null;

  constructor(
    private readonly repository: IntegrationsRepository,
    private readonly config: ConfigService,
    private readonly journal: AdminJournalService,
  ) {
    const secret = this.config.get<string>('SETTINGS_ENCRYPTION_KEY');
    this.key = secret ? deriveSettingsKey(secret) : null;
  }

  /** A field's value: the stored one, else its environment variable. */
  async get(fieldKey: string): Promise<string | undefined> {
    const field = integrationFieldOf(fieldKey);
    if (!field) return undefined;
    const stored = (await this.values()).get(fieldKey);
    return stored ?? this.config.get<string>(field.env) ?? undefined;
  }

  /** Every stored value, decrypted, read again after CACHE_MS. */
  private values(now: number = Date.now()): Promise<Map<string, string>> {
    if (this.cache && now - this.cache.at < CACHE_MS) return this.cache.values;
    const values = this.repository
      .rows()
      .then((rows) => {
        const read = readIntegrationRows(rows, this.key);
        if (read.unreadable.length > 0) {
          logger.warn(
            { keys: read.unreadable },
            'Stored secrets unreadable (SETTINGS_ENCRYPTION_KEY absent or changed): the environment serves',
          );
        }
        return read.values;
      })
      .catch((err: unknown) => {
        logger.warn(
          { err },
          'integration_setting unreadable: the environment serves',
        );
        return new Map<string, string>();
      });
    this.cache = { at: now, values };
    return values;
  }

  async list(): Promise<IntegrationView[]> {
    const rows = new Map(
      (await this.repository.rows()).map((row) => [row.key, row]),
    );
    const readable = readIntegrationRows([...rows.values()], this.key);
    return INTEGRATIONS.map((integration) => ({
      key: integration.key,
      fields: integration.fields.map((field) => {
        const row: IntegrationRow | undefined = rows.get(field.key);
        const env = this.config.get<string>(field.env);
        const stored =
          row !== undefined && !readable.unreadable.includes(field.key);
        return {
          key: field.key,
          env: field.env,
          secret: field.secret,
          source: stored ? 'stored' : env ? 'env' : 'none',
          unreadable: readable.unreadable.includes(field.key),
          // Never a secret: only an address or a name.
          value: field.secret
            ? null
            : (readable.values.get(field.key) ?? env ?? null),
          updatedAt: row?.updatedAt.toISOString() ?? null,
          updatedBy: row?.updatedBy ?? null,
        };
      }),
    }));
  }

  /** Whether secrets can be saved here (SETTINGS_ENCRYPTION_KEY is set). */
  canEncrypt(): boolean {
    return this.key !== null;
  }

  async set(input: {
    key: string;
    value: string;
    actorId: string;
  }): Promise<void> {
    const field = integrationFieldOf(input.key);
    if (!field) throw new BadRequestException('Champ inconnu');
    const value = input.value.trim();
    if (!value) throw new BadRequestException('Valeur vide');
    if (field.secret && !this.key) {
      throw new BadRequestException(
        'SETTINGS_ENCRYPTION_KEY absente : un secret ne peut pas être enregistré',
      );
    }
    await this.repository.write({
      key: field.key,
      value: field.secret && this.key ? encryptSetting(value, this.key) : value,
      secret: field.secret,
      actorId: input.actorId,
    });
    this.cache = null;
    // Who and when, never the value: a secret stays out of the journal.
    await this.journal.record({
      actorId: input.actorId,
      kind: 'integration_set',
      target: field.key,
      after: field.secret ? null : value,
    });
  }

  /** Removes a stored value: its environment variable serves again. */
  async clear(input: { key: string; actorId: string }): Promise<void> {
    const field = integrationFieldOf(input.key);
    if (!field) throw new BadRequestException('Champ inconnu');
    await this.repository.remove(field.key);
    this.cache = null;
    await this.journal.record({
      actorId: input.actorId,
      kind: 'integration_cleared',
      target: field.key,
    });
  }
}
