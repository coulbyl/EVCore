import { IsIn, IsOptional } from 'class-validator';
import type { PromotionWindow } from '../reports.types';

const WINDOWS: PromotionWindow[] = ['P7D', 'P30D', 'P90D', 'SINCE_ACTIVATION'];

export class MlPromotionQueryDto {
  @IsOptional()
  @IsIn(WINDOWS)
  window?: PromotionWindow;
}
