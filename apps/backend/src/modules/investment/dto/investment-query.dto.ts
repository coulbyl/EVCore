import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import type { InvestmentMode } from '../investment.constants';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class InvestmentQueryDto {
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsString()
  competitionCode?: string;

  // "probability" (default): tous les canaux, classés par chance de gagner.
  // "value": VALUE uniquement, EV >= EV_THRESHOLD, classés par EV.
  // "safe"/"dominant"/"btts"/"goals"/"draw": ce canal seul, classé par
  // chance de gagner (voir SINGLE_CHANNEL_MODE_MAP).
  @IsOptional()
  @IsIn(['probability', 'value', 'safe', 'dominant', 'btts', 'goals', 'draw'])
  mode?: InvestmentMode;
}
