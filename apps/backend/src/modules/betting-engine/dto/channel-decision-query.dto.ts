import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import {
  ChannelDecisionStatus,
  Market,
  ModelRunPhase,
  StrategyChannel,
} from '@evcore/db';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Comma-separated in the URL (?competition=PL,BL1) — one query param stays
// readable/shareable, and a single value degrades to a 1-element array with
// no special-casing needed by the caller (the facet drawer, §2bis: checkbox
// per line, multi-select within a section).
function splitCommaList(value: unknown): unknown {
  return typeof value === 'string' ? value.split(',').filter(Boolean) : value;
}

export class ChannelDecisionListQueryDto {
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @Transform(({ value }) => splitCommaList(value))
  @IsString({ each: true })
  competition?: string[];

  @IsOptional()
  @Transform(({ value }) => splitCommaList(value))
  @IsEnum(StrategyChannel, { each: true })
  channel?: StrategyChannel[];

  @IsOptional()
  @IsEnum(Market)
  market?: Market;

  @IsOptional()
  @IsEnum(ChannelDecisionStatus)
  status?: ChannelDecisionStatus;

  @IsOptional()
  @IsEnum(ModelRunPhase)
  phase?: ModelRunPhase;
}

export class ChannelDecisionFacetsQueryDto {
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE, { message: 'date must be YYYY-MM-DD' })
  date?: string;
}
