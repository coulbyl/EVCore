import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsString()
  comboMarket?: string;

  @IsOptional()
  @IsString()
  comboPick?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  stakeOverride?: number;
}

export class CreateBetSlipDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitStake!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateBetSlipItemDto)
  items!: CreateBetSlipItemDto[];

  @IsOptional()
  @IsString()
  name?: string;
}

export type CreateBetSlipItemInput = CreateBetSlipItemDto;
