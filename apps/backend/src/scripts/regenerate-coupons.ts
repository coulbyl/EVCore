/**
 * Re-generate coupon proposals for a bounded date range with the CURRENT
 * composer code — so historical coupons reflect the session's fixes
 * (VALUE/SAFE bet-persistence, Kelly removal, DNB/WIN_TO_NIL/RESULT_BTTS
 * shrinkage, VALUE market-trust weighting) instead of whatever config was
 * live whenever they were first generated.
 *
 * Also force-settles the whole range afterward (CouponSettlementService.
 * settleRange) — every regenerated fixture in the range is already
 * FINISHED, so this doubles as a real backtest of the current composer:
 * regenerate with today's code, settle immediately, read WON/LOST/PARTIAL
 * off the resulting CouponProposal rows.
 *
 * Unlike reanalyze-scope.ts, this does NOT need an explicit wipe step:
 * `CouponRepository.upsertProposal` already deletes+recreates a PENDING
 * proposal's legs in place, and `CouponService.generateCoupons` calls
 * `deletePendingForDate` up front — both keyed on the same unique
 * constraint (forDate, signalWindowDays, targetOddsMin, targetOddsMax,
 * rank). Proposals a human has already ACCEPTED/REJECTED are preserved
 * untouched (upsertProposal bails out on non-PENDING status) — re-running
 * this can never silently discard a decision someone already made.
 *
 * Mirrors CouponWorker.process's real window/profile logic
 * (resolveGenerationWindow: Fri→Sun and Tue→Thu widen the fixture pool and
 * add a LONGSHOT_WEEKEND/MIDWEEK profile) so the replayed output matches
 * what production would have generated under today's code, not a
 * simplified single-day approximation.
 *
 * `--profile SAFE|BALANCED|AGGRESSIVE` forces every day onto that single
 * named profile (coupon.constants.ts's COUPON_PROFILES) instead of the live
 * DEFAULT_COUPON_PROFILE + auto weekend/midweek longshot window — for
 * A/B-backtesting an alternative profile. Safe to rerun on the same range
 * as a DEFAULT run: distinct profiles land on distinct targetOddsMin/Max,
 * hence distinct unique-constraint rows (no clobbering).
 *
 * Dev-only. Run after build:
 *   cd apps/backend && pnpm build
 *   node dist/src/scripts/regenerate-coupons.js --from 2026-05-01 --to 2026-08-31 --dry-run
 *   node dist/src/scripts/regenerate-coupons.js --from 2026-05-01 --to 2026-08-31
 *   node dist/src/scripts/regenerate-coupons.js --from 2026-05-01 --to 2026-08-31 --profile SAFE
 */

// Must run before any import that initialises the Prisma client (@evcore/db).
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { addDays } from 'date-fns';
import { PrismaModule } from '@/prisma.module';
import { CouponModule } from '@modules/coupon/coupon.module';
import { CouponService } from '@modules/coupon/coupon.service';
import { CouponSettlementService } from '@modules/coupon/coupon-settlement.service';
import { CouponRepository } from '@modules/coupon/coupon.repository';
import { resolveGenerationWindow } from '@modules/etl/workers/coupon.worker';
import type { CouponProfileName } from '@modules/coupon/coupon.constants';
import { formatDateUtc } from '@utils/date.utils';
import { createLogger } from '@utils/logger';

const logger = createLogger('regenerate-coupons');

const NAMED_PROFILES = ['SAFE', 'BALANCED', 'AGGRESSIVE'] as const;

type ScriptArgs = {
  from: string | null;
  to: string | null;
  dryRun: boolean;
  // Forces every day onto this single named profile instead of the live
  // DEFAULT_COUPON_PROFILE + auto weekend/midweek longshot window — for
  // A/B-backtesting an alternative profile (e.g. SAFE) without disturbing
  // the DEFAULT rows already generated for the same range (distinct
  // targetOddsMin/Max ⇒ distinct unique-constraint rows, see coupon.service.ts).
  profile: (typeof NAMED_PROFILES)[number] | null;
};

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CouponModule,
  ],
})
class RegenerateCouponsModule {}

function parseArgs(argv: string[]): ScriptArgs {
  const args: ScriptArgs = {
    from: null,
    to: null,
    dryRun: false,
    profile: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--from') args.from = argv[(i += 1)] ?? null;
    else if (arg === '--to') args.to = argv[(i += 1)] ?? null;
    else if (arg === '--profile') {
      const value = argv[(i += 1)] ?? null;
      if (
        !value ||
        !NAMED_PROFILES.includes(value as (typeof NAMED_PROFILES)[number])
      ) {
        throw new Error(
          `--profile must be one of: ${NAMED_PROFILES.join(', ')}`,
        );
      }
      args.profile = value as (typeof NAMED_PROFILES)[number];
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node dist/src/scripts/regenerate-coupons.js --from D --to D [--dry-run] [--profile SAFE|BALANCED|AGGRESSIVE]',
      );
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.from || !args.to) {
    throw new Error('Provide --from and --to (YYYY-MM-DD, inclusive)');
  }
  return args;
}

function* dateRange(from: string, to: string): Generator<string> {
  let cursor = new Date(`${from}T12:00:00.000Z`);
  const end = new Date(`${to}T12:00:00.000Z`);
  while (cursor.getTime() <= end.getTime()) {
    yield formatDateUtc(cursor);
    cursor = addDays(cursor, 1);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dates = Array.from(dateRange(args.from!, args.to!));
  console.log(
    `EVCore — regenerate coupons (from=${args.from} to=${args.to}, ${dates.length} days, dryRun=${args.dryRun})`,
  );

  if (args.dryRun) {
    for (const date of dates) {
      const { to, longshotProfile } = resolveGenerationWindow(date);
      console.log(
        `  ${date} → window to=${to}${longshotProfile ? `, +${longshotProfile}` : ''}`,
      );
    }
    console.log(`Would regenerate ${dates.length} day(s), see windows above.`);
    return;
  }

  const app = await NestFactory.createApplicationContext(
    RegenerateCouponsModule,
    { logger: ['error', 'warn'] },
  );
  const coupon = app.get(CouponService);
  const settlement = app.get(CouponSettlementService);
  const repo = app.get(CouponRepository);

  // Wipe EXPIRED proposals in the range FIRST — upsertProposal bails out on
  // any non-PENDING status (including EXPIRED) to protect human decisions,
  // which silently no-ops a re-run against a range a PRIOR run already
  // regenerated+settled (see deleteExpiredInRange's doc). Never touches
  // ACCEPTED/REJECTED.
  const wiped = await repo.deleteExpiredInRange(
    new Date(`${args.from}T00:00:00.000Z`),
    new Date(`${args.to}T23:59:59.999Z`),
  );
  if (wiped > 0) {
    console.log(`Wiped ${wiped} previously-EXPIRED proposal(s) in range.`);
  }

  let done = 0;
  for (const date of dates) {
    try {
      if (args.profile) {
        await coupon.generateCoupons(date, {
          to: date,
          profile: args.profile as CouponProfileName,
        });
      } else {
        const { to, longshotProfile } = resolveGenerationWindow(date);
        await coupon.generateCoupons(date, { to });
        if (longshotProfile) {
          await coupon.generateCoupons(date, { to, profile: longshotProfile });
        }
      }
    } catch (err) {
      logger.error({ date, err }, 'Failed to regenerate coupons for date');
    }
    done += 1;
    if (done % 10 === 0) console.log(`… ${done}/${dates.length}`);
  }
  console.log(`Done → regenerated ${done}/${dates.length} day(s).`);

  console.log('Settling the regenerated range…');
  const { resettled } = await settlement.settleRange(
    new Date(`${args.from}T00:00:00.000Z`),
    new Date(`${args.to}T23:59:59.999Z`),
  );
  console.log(`Settled ${resettled} proposal(s) — read results from the DB.`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
