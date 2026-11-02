import { CONSOLE_CALIBRATION as C } from '@config/console.constants';
import type { ChannelCell } from './console.types';

/**
 * A channel × competition cell from its settled legs (12-admin.md § 2):
 * ratio realised/announced with a 95 % interval on the realised rate; an
 * alert when even the interval's top stays under GOOD_RATIO, « optimiste »
 * when only the ratio does.
 */
export function cellOf(input: {
  channel: string;
  competitionCode: string;
  competitionName: string;
  sample: number;
  announced: number | null;
  realised: number | null;
  enough: boolean;
}): ChannelCell {
  const { sample, announced, realised } = input;
  const base = {
    channel: input.channel,
    competitionCode: input.competitionCode,
    competitionName: input.competitionName,
    sample,
    announced,
    realised,
  };
  if (
    !input.enough ||
    announced === null ||
    realised === null ||
    announced <= 0 ||
    sample === 0
  ) {
    return { ...base, ratio: null, low: null, high: null, word: 'not_enough' };
  }
  const half = C.Z_95 * Math.sqrt((realised * (1 - realised)) / sample);
  const ratio = realised / announced;
  const low = Math.max(0, realised - half) / announced;
  const high = (realised + half) / announced;
  const word =
    high < C.GOOD_RATIO
      ? 'alert'
      : ratio < C.GOOD_RATIO
        ? 'optimistic'
        : 'conforme';
  return { ...base, ratio, low, high, word };
}
