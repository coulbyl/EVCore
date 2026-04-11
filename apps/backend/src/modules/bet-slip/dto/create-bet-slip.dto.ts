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
  @IsUUID()
  betId!: string;

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
