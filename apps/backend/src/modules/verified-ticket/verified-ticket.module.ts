import { Module } from '@nestjs/common';
import { VerifiedTicketRepository } from './verified-ticket.repository';
import { VerifiedTicketService } from './verified-ticket.service';

/**
 * The anonymous count of verified tickets (07 § 7). Recorded by
 * POST /ticket/quote with the figures it computes: the device no longer
 * sends its own (C7).
 */
@Module({
  providers: [VerifiedTicketService, VerifiedTicketRepository],
  exports: [VerifiedTicketService],
})
export class VerifiedTicketModule {}
