import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema';

const base = { DATABASE_URL: 'postgresql://localhost:5432/evcore' };

describe('validateEnv', () => {
  it('gives the configuration back untouched, strings stay strings', () => {
    const env = {
      ...base,
      REDIS_PORT: '6379',
      ETL_SCHEDULING_ENABLED: 'false',
    };
    expect(validateEnv(env)).toBe(env);
    expect(validateEnv(env).REDIS_PORT).toBe('6379');
  });

  it('refuses a missing database, naming it', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('refuses a malformed port or address', () => {
    expect(() => validateEnv({ ...base, REDIS_PORT: 'six' })).toThrow(
      /REDIS_PORT/,
    );
    expect(() => validateEnv({ ...base, APP_URL: 'c-evcore.com' })).toThrow(
      /APP_URL/,
    );
  });

  it('requires the TOTP secret in production only', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(
      /TOTP_APP_SECRET/,
    );
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'development' }),
    ).not.toThrow();
  });

  it('a retired variable is warned about, never refused', () => {
    expect(() =>
      validateEnv({ ...base, ETL_BETTING_ENGINE_ANALYSIS_CRON: '0 21 * * *' }),
    ).not.toThrow();
  });

  it('an empty value is an absent one, as dotenv loads `KEY=`', () => {
    expect(() =>
      validateEnv({ ...base, ADMIN_API_TOKEN: '', RUSTFS_PUBLIC_ENDPOINT: '' }),
    ).not.toThrow();
    expect(() => validateEnv({ DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
  });
});
