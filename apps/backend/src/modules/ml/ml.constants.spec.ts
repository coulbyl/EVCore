// Anti-drift guard (docs/ml-worker-sync.md §"garde-fou"): ML_SEGMENTS /
// ML_SHADOW_CHANNELS must stay in sync with train.py's VALID_SEGMENTS and
// with the shared contract also checked from analysis-core and ml-worker —
// see ml-shadow-contract.json and its Python test counterpart.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ML_SEGMENTS, ML_SHADOW_CHANNELS } from './ml.constants';

type Contract = {
  liveShadowChannels: string[];
  trainingSegments: string[];
};

const contract: Contract = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '../../../../../packages/analysis-core/src/score/ml-shadow-contract.json',
    ),
    'utf-8',
  ),
);

describe('ML_SEGMENTS / ML_SHADOW_CHANNELS — drift guard', () => {
  it('matches the shared training-segments contract exactly', () => {
    expect([...ML_SEGMENTS].sort()).toEqual(
      [...contract.trainingSegments].sort(),
    );
  });

  it('matches the shared live-shadow-channels contract exactly', () => {
    expect([...ML_SHADOW_CHANNELS].sort()).toEqual(
      [...contract.liveShadowChannels].sort(),
    );
  });
});
