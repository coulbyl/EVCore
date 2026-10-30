import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PausedGuard } from '@/common/guards/paused.guard';
import { VERIFIED_TICKET_RATE_LIMIT } from '@config/verified-ticket.constants';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { RecordVerifiedTicketDto } from './dto/record-verified-ticket.dto';
import { VerifiedTicketService } from './verified-ticket.service';

/**
 * « Vérifie ton ticket » est un outil de pari : la pause le ferme comme les
 * suggestions. La session sert à refuser les appels anonymes, jamais à
 * rattacher le ticket au joueur.
 */
@ApiTags('screens')
@Controller('verified-tickets')
@UseGuards(AuthSessionGuard, PausedGuard)
export class VerifiedTicketController {
  constructor(private readonly tickets: VerifiedTicketService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({
    default: {
      limit: VERIFIED_TICKET_RATE_LIMIT.limit,
      ttl: VERIFIED_TICKET_RATE_LIMIT.ttlMs,
    },
  })
  @ApiOperation({
    summary: 'Count a verified ticket, anonymously',
    description:
      'Number of bets, total odds and chance of a ticket checked on the device; the day is the server one. Nothing identifies the player or the bets.',
  })
  @ApiNoContentResponse({ description: 'Counted.' })
  async record(@Body() body: RecordVerifiedTicketDto): Promise<void> {
    await this.tickets.record(body);
  }
}
