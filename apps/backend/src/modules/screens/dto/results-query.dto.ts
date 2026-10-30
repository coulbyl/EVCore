import { IsIn, IsOptional } from 'class-validator';
import { RESULTS_PERIODS } from '@config/results.constants';
import type { ResultsPeriod } from '../results.types';

export class ResultsQueryDto {
  /** 30 j · 90 j · Tout (08 § 1). */
  @IsOptional()
  @IsIn(RESULTS_PERIODS)
  period?: ResultsPeriod;
}
