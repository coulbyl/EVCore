import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  INVESTMENT_LIMITS,
  type InvestmentMode,
} from '../investment.constants';

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
  // "value": VALUE uniquement, EV >= EV_THRESHOLD, classés par edge calibré.
  // "safe"/"dominant"/"btts"/"goals"/"draw": ce canal seul, tri et cap par
  // canal (voir MODE_RANKING).
  @IsOptional()
  @IsIn(['probability', 'value', 'safe', 'dominant', 'btts', 'goals', 'draw'])
  mode?: InvestmentMode;

  // Filtre d'affichage côté client : remplace le topN par défaut du mode
  // (MODE_RANKING), borné par le plafond global — jamais au-delà.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(INVESTMENT_LIMITS.maxPicks)
  topN?: number;
}
