import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BetSlipType } from '@evcore/db';
import { SLIP_LIMITS } from '@/config/bankroll.constants';

class CreateBetSlipItemDto {
  /** Référence un bet MODEL déjà créé par le moteur. */
  @IsOptional()
  @IsUUID()
  betId?: string;

  /** Pour les picks utilisateur : ID du ModelRun source. */
  @IsOptional()
  @IsUUID()
  modelRunId?: string;

  @IsOptional()
  @IsString()
  market?: string;

  @IsOptional()
  @IsString()
  pick?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(SLIP_LIMITS.MAX_UNIT_STAKE)
  stakeOverride?: number;
}

export class CreateBetSlipDto {
  @IsOptional()
  @IsEnum(BetSlipType)
  type?: BetSlipType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(SLIP_LIMITS.MAX_UNIT_STAKE)
  unitStake!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(SLIP_LIMITS.MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => CreateBetSlipItemDto)
  items!: CreateBetSlipItemDto[];

  @IsOptional()
  @IsString()
  name?: string;
}

export type CreateBetSlipItemInput = CreateBetSlipItemDto;
