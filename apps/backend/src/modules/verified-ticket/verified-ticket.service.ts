import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { VERIFIED_TICKET_LIMITS } from '@config/verified-ticket.constants';
import { VerifiedTicketRepository } from './verified-ticket.repository';

/**
 * Compte qu'un ticket a été vérifié, sans rien qui l'identifie (07 § 7) : le
 * ticket vit sur l'appareil, le serveur n'en garde que la forme. Le jour est
 * celui du serveur (UTC, l'heure d'Abidjan), jamais celui de l'appareil.
 * Les chiffres sont ceux que POST /ticket/quote vient de calculer.
 */
export type VerifiedTicketShape = {
  legCount: number;
  totalOdds: number;
  /** Produit des fréquences sans marge ; strictement positif. */
  chance: number;
};

@Injectable()
export class VerifiedTicketService {
  constructor(private readonly repository: VerifiedTicketRepository) {}

  async record(
    input: VerifiedTicketShape,
    now: Date = new Date(),
  ): Promise<void> {
    // Beyond what the columns hold (a chance rounded to 0, odds past
    // DECIMAL(14, 3)): not counted rather than stored wrong.
    if (
      input.chance < VERIFIED_TICKET_LIMITS.minChance ||
      input.totalOdds > VERIFIED_TICKET_LIMITS.maxTotalOdds
    ) {
      return;
    }
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
