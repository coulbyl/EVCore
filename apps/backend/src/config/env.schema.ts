import { z } from 'zod';
import { createLogger } from '@utils/logger';

const logger = createLogger('env');

/**
 * What the backend reads from its environment (ENV-PROD § 6): secrets and
 * addresses only, plus the process settings of the image. Every decision —
 * hours, thresholds, flags — lives in `config/`, every operator switch in
 * `app_setting`.
 *
 * Refused at start: only what would break anyway — the database, and in
 * production the TOTP secret every session needs. The rest is checked for
 * its shape when present: a malformed port or URL is a typo to catch at
 * start, not at the first job.
 */
const port = z.coerce.number().int().min(1).max(65_535);
const url = z.string().url();
const flag = z.enum(['true', 'false']);

export const ENV_SCHEMA = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
    PORT: port.optional(),
    HOST: z.string().min(1).optional(),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .optional(),
    LOG_DIR: z.string().min(1).optional(),

    DATABASE_URL: z.string().min(1),
    PGBOUNCER_URL: z.string().min(1).optional(),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().optional(),
    REDIS_HOST: z.string().min(1).optional(),
    REDIS_PORT: port.optional(),

    APP_URL: url.optional(),
    CORS_ORIGINS: z.string().min(1).optional(),
    AUTH_COOKIE_DOMAIN: z.string().min(1).optional(),
    TOTP_APP_SECRET: z.string().min(1).optional(),
    ADMIN_API_TOKEN: z.string().min(1).optional(),

    API_FOOTBALL_KEY: z.string().min(1).optional(),
    THE_ODDS_API_KEY: z.string().min(1).optional(),
    ML_WORKER_URL: url.optional(),

    RESEND_API_KEY: z.string().min(1).optional(),
    RESEND_FROM: z.string().min(1).optional(),
    RESEND_ADMIN_TO: z.string().min(1).optional(),

    VAPID_PUBLIC_KEY: z.string().min(1).optional(),
    VAPID_PRIVATE_KEY: z.string().min(1).optional(),
    VAPID_SUBJECT: z.string().min(1).optional(),

    RUSTFS_ENDPOINT: url.optional(),
    RUSTFS_PUBLIC_ENDPOINT: url.optional(),
    RUSTFS_REGION: z.string().min(1).optional(),
    RUSTFS_BUCKET: z.string().min(1).optional(),
    RUSTFS_ACCESS_KEY: z.string().min(1).optional(),
    RUSTFS_SECRET_KEY: z.string().min(1).optional(),

    // A machine guard, not a decision: a local copy of production must be
    // able to start without calling API-Football. In production the switch
    // is the `app_setting` row (F3).
    ETL_SCHEDULING_ENABLED: flag.optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.TOTP_APP_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['TOTP_APP_SECRET'],
        message: 'required in production',
      });
    }
  });

/**
 * Variables the code no longer reads (ENV-PROD § 2 and § 6): said once at
 * start so the .env gets cleaned, never a refusal — a production .env not
 * cleaned yet must not stop a deploy.
 */
export const RETIRED_ENV = [
  'KELLY_ENABLED',
  'COUPON_ENFORCE_AVOID',
  'COUPON_ENFORCE_AVOID_FADE',
  'COUPON_STAKE_DRAW',
  'ODDS_SNAPSHOT_RETENTION_DAYS',
  'ETL_ENABLE_ROLLING_HORIZON',
  'ETL_ROLLING_HORIZON_DAYS',
  'ETL_STANDINGS_COMPETITIONS',
  'ETL_STANDINGS_SYNC_CRON',
  'GROQ_API_KEY',
  'GROQ_RESEARCH_MODEL',
  'VANTAGE_COMPETITION_CODES',
  'ETL_FIXTURES_SYNC_CRON',
  'ETL_PENDING_BETS_SETTLEMENT_CRON',
  'ETL_STALE_SCHEDULED_SYNC_CRON',
  'ETL_STATS_SYNC_CRON',
  'ETL_INJURIES_SYNC_CRON',
  'ETL_ODDS_CSV_IMPORT_CRON',
  'ETL_ELO_SYNC_CRON',
  'ETL_COACH_SYNC_CRON',
  'ETL_ODDS_PREMATCH_SYNC_CRON',
  'ETL_ODDS_CLOSING_SYNC_CRON',
  'ETL_RISK_MARKET_SWEEP_CRON',
  'ETL_BETTING_ENGINE_ANALYSIS_CRON',
  'ETL_SAME_DAY_ANALYSIS_CRON',
  'ETL_ROLLING_HORIZON_CRON',
  'ETL_SEASON_ROLLOVER_SYNC_CRON',
  'ETL_STATS_BACKFILL_CRON',
  'ETL_REBUILD_CONCURRENCY',
  'STALE_SCHEDULED_SYNC_LOOKBACK_DAYS',
  'SHADOW_PREDICTIONS_ENABLED',
  'ML_CORRECTION_ENABLED',
  'SLIP_DIGEST_CRON',
  'WEEKLY_STATEMENT_CRON',
  'FOLLOWED_SETTLED_CRON',
  'API_FOOTBALL_DAILY_QUOTA',
  'API_FOOTBALL_AVG_DAILY_FIXTURES_PER_LEAGUE',
  'API_FOOTBALL_AVG_DAILY_STATS_FIXTURES_PER_LEAGUE',
] as const;

/**
 * `ConfigModule.forRoot({ validate })`: throws on a broken environment,
 * warns on retired variables, and gives the configuration back untouched —
 * the code reads strings and compares them as such.
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  // `KEY=` in a .env loads as an empty string: absent, not malformed.
  const present = Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== ''),
  );
  const result = ENV_SCHEMA.safeParse(present);
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid environment:\n${lines.join('\n')}`);
  }
  const retired = RETIRED_ENV.filter((name) => present[name] !== undefined);
  if (retired.length > 0) {
    logger.warn(
      { retired },
      'Environment variables no longer read: remove them from the .env',
    );
  }
  return config;
}
