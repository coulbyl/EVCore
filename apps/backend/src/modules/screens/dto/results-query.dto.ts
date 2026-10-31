import { IsOptional, Matches } from 'class-validator';
import {
  RESULTS_PERIODS,
  RESULTS_RANGE_PATTERN,
} from '@config/results.constants';
import type { ResultsPeriod } from '../results.types';

const PERIOD_PATTERN = new RegExp(
  `^(${RESULTS_PERIODS.join('|')})$|${RESULTS_RANGE_PATTERN.source}`,
);

export class ResultsQueryDto {
  /** 30 j · 90 j · Tout, or « 2026-10-13..2026-10-25 » (08 § 1). */
  @IsOptional()
  @Matches(PERIOD_PATTERN)
  period?: ResultsPeriod;
}
