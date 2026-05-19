/**
 * Investment backtest — step 2 of the investment page spec.
 *
 * Bootstraps the NestJS application context (no HTTP server) so that the
 * existing BettingEngineService and BacktestService are reused without
 * duplication. Runs the full grid search and writes 4 report files:
 *
 *   reports/backtest-grid-search.csv
 *   reports/backtest-correlation-matrix.csv
 *   reports/backtest-conf-by-league.csv
 *   reports/backtest-selected-params.json
 *
 * Run: cd apps/backend && pnpm build && node dist/scripts/backtest-investment.js
 *
 * Prerequisites:
 *   - scripts/backtest-data-audit.ts passed all feasibility gates
 *   - Database is running and DATABASE_URL is set
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { NestFactory } from '@nestjs/core';
import { PrismaModule } from '@/prisma.module';
import { BettingEngineModule } from '@modules/betting-engine/betting-engine.module';
import { BacktestModule } from '@modules/backtest/backtest.module';
import { InvestmentBacktestService } from '@modules/backtest/investment-backtest.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    PrismaModule,
    BettingEngineModule,
    BacktestModule,
  ],
})
class BacktestScriptModule {}

async function main(): Promise<void> {
  console.log('EVCore — Investment backtest\n');
  console.log('Bootstrapping NestJS context (no HTTP server)...');

  const app = await NestFactory.createApplicationContext(BacktestScriptModule, {
    logger: ['error', 'warn'],
  });

  const svc = app.get(InvestmentBacktestService);

  console.log('Running backtest + grid search...\n');
  const output = await svc.run();

  console.log('\n═══ RESULTS ══════════════════════════════════════════════');
  console.log(
    `Dataset       : ${output.gridSearchRows[0]?.trainCoupons !== undefined ? '✓' : '–'}`,
  );
  console.log(
    `Train ROI     : ${(Number(output.trainResult.roi) * 100).toFixed(1)}%`,
  );
  console.log(
    `Test ROI      : ${(Number(output.testResult.roi) * 100).toFixed(1)}%`,
  );
  console.log(
    `Test hit rate : ${(Number(output.testResult.hitRate) * 100).toFixed(1)}%`,
  );
  console.log(`Test coupons  : ${output.testResult.totalCoupons}`);
  console.log(`Grid rows     : ${output.gridSearchRows.length}`);

  console.log('\n═══ SELECTED PARAMS ══════════════════════════════════════');
  const p = output.selectedParams;
  console.log(`  k                          = ${p.k}`);
  console.log(
    `  minCalibratedJointProb     = ${p.minCalibratedJointProbability}`,
  );
  console.log(`  maxLegs                    = ${p.maxLegs}`);
  console.log(`  maxCombinedOdds            = ${p.maxCombinedOdds}`);
  console.log(`  capMin / capMax            = ${p.capMin} / ${p.capMax}`);
  console.log(`  recencyWeighting           = ${p.recencyWeighting}`);
  console.log(`  nLeagueMin                 = ${p.nLeagueMin}`);
  console.log(`  includeConfInCoupons       = ${p.includeConfInCoupons}`);

  console.log('\n═══ CORRELATION MATRIX ═══════════════════════════════════');
  for (const [pair, factor] of Object.entries(output.correlationMatrix)) {
    const flag =
      factor > 1.3 ? ' ← correlated' : factor < 0.8 ? ' ← anti-corr' : '';
    console.log(`  ${pair.padEnd(12)} ${Number(factor).toFixed(3)}${flag}`);
  }

  console.log('\nReports saved to apps/backend/reports/');

  await app.close();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
