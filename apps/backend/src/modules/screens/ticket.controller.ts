import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PausedGuard } from '@/common/guards/paused.guard';
import { TICKET_QUOTE_RATE_LIMIT } from '@config/screens.constants';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { TicketQuoteDto } from './dto/ticket-quote.dto';
import { TicketService } from './ticket.service';
import type { TicketQuote } from './ticket.types';

/**
 * « Vérifie ton ticket » is a betting tool: the pause closes it like the
 * suggestions. The session only refuses anonymous calls; the ticket is
 * never tied to the player (07 § 7).
 */
@ApiTags('screens')
@Controller('ticket')
@UseGuards(AuthSessionGuard, PausedGuard)
export class TicketController {
  constructor(private readonly tickets: TicketService) {}

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: TICKET_QUOTE_RATE_LIMIT.limit,
      ttl: TICKET_QUOTE_RATE_LIMIT.ttlMs,
    },
  })
  @ApiOperation({
    summary: 'Price the ticket kept on the device',
    description:
      'Current 1xBet price and fair frequency of each bet, the total odds, the chance and what 1xBet keeps (decimal), and the hero coupon of the day. With `verify`, counts the ticket anonymously.',
  })
  @ApiOkResponse({ description: 'The ticket, priced now.' })
  quote(@Body() body: TicketQuoteDto): Promise<TicketQuote> {
    return this.tickets.quote(body);
  }
}
