import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { VerifiedTicketRepository } from './verified-ticket.repository';
import type { RecordVerifiedTicketDto } from './dto/record-verified-ticket.dto';

/**
 * Compte qu'un ticket a été vérifié, sans rien qui l'identifie (07 § 7) : le
 * ticket vit sur l'appareil, le serveur n'en garde que la forme. Le jour est
 * celui du serveur (UTC, l'heure d'Abidjan), jamais celui de l'appareil.
 * L'appareil l'envoie une fois par ticket vérifié.
 */
@Injectable()
export class VerifiedTicketService {
  constructor(private readonly repository: VerifiedTicketRepository) {}

  async record(
    input: RecordVerifiedTicketDto,
    now: Date = new Date(),
  ): Promise<void> {
    await this.repository.create({
      day: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      ),
      legCount: input.legCount,
      totalOdds: new Decimal(input.totalOdds).toDecimalPlaces(3).toString(),
      chance: new Decimal(input.chance).toDecimalPlaces(10).toString(),
    });
  }
}
