// Runs the current pure validator in memory. No app startup, dotenv or DB.
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const ts = require('../../../node_modules/typescript');
const root = resolve(__dirname, '../../..');
const workerRequire = createRequire(resolve(root, 'apps/vantage-worker/package.json'));
const core = workerRequire('@evcore/analysis-core');
const source = readFileSync(resolve(root, 'apps/vantage-worker/src/coupon/validate-coupon-selection.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exportsObject = {};
new Function('exports', 'require', compiled)(exportsObject, workerRequire);
const legs = ['DOMINANT', 'BTTS'].map((canal, i) => ({
  reasoning: 'Synthetic audit case',
  candidate: {
    fixtureId: `audit-${i}`, competition: `audit-league-${i}`, dayBucket: '2026-09-13',
    canal, market: i ? 'BTTS' : 'ONE_X_TWO', pick: i ? 'YES' : 'HOME',
    probability: 0.5, calibratedProbability: 0.5, calibratedHitRate: 0.5,
    oddsSnapshot: 1.5, referenceOdds: 1.5, featureSnapshot: { competitionCode: 'PL' },
  },
}));
const result = exportsObject.validateCouponSelection(
  legs, core.COUPON_CLASSES.find(c => c.name === 'SAFE'), core.COUPON_BOUNDS,
);
if (result.outcome !== 'rejected' || !result.reason.includes('non-positive EV')) {
  throw new Error('The negative-EV coupon was not rejected.');
}
console.log(JSON.stringify(result, null, 2));
