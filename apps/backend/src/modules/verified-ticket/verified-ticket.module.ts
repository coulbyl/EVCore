import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { VerifiedTicketController } from './verified-ticket.controller';
import { VerifiedTicketRepository } from './verified-ticket.repository';
import { VerifiedTicketService } from './verified-ticket.service';

@Module({
  imports: [AuthModule],
  controllers: [VerifiedTicketController],
  providers: [VerifiedTicketService, VerifiedTicketRepository],
})
export class VerifiedTicketModule {}
