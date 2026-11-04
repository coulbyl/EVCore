import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsDateString,
  IsEnum,
  IsNumber,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Market } from '@evcore/db';
import { VERIFIED_TICKET_LIMITS } from '@config/verified-ticket.constants';
import { TICKET_LINE_MAX } from '@config/screens.constants';

export class TicketLegDto {
  @IsUUID()
  fixtureId!: string;

  @IsEnum(Market)
  market!: Market;

  @Matches(/^[A-Z0-9_]+$/)
  @MaxLength(40)
  pick!: string;

  /**
   * The line of a market that keeps it apart from `pick` (corners, cards,
   * player shots, the minute of a minute's 1X2), as the sheet gave it.
   */
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(TICKET_LINE_MAX)
  line?: number | null;
}

/** The bets of « Mon ticket », as the device keeps them (07 § 4). */
export class TicketQuoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(VERIFIED_TICKET_LIMITS.maxLegs)
  @ValidateNested({ each: true })
  @Type(() => TicketLegDto)
  legs!: TicketLegDto[];

  /**
   * The player opened the sheet on a ticket not counted yet: count it,
   * anonymously, with the figures computed here (07 § 7).
   */
  @IsOptional()
  @IsBoolean()
  verify?: boolean;

  /**
   * The day whose hero coupon to compare with (YYYY-MM-DD): yesterday's for
   * the ticket of yesterday (07 § 6). Today when absent.
   */
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day?: string;
}
