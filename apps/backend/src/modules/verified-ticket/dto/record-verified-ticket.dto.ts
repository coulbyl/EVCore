import { IsInt, IsNumber, Max, Min } from 'class-validator';
import { VERIFIED_TICKET_LIMITS } from '@config/verified-ticket.constants';

/**
 * Ce que l'appareil sait du ticket qu'il vient de vérifier (07 § 4). Les
 * paris eux-mêmes ne sont jamais envoyés.
 */
export class RecordVerifiedTicketDto {
  @IsInt()
  @Min(1)
  @Max(VERIFIED_TICKET_LIMITS.maxLegs)
  legCount!: number;

  @IsNumber({ maxDecimalPlaces: 3, allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(VERIFIED_TICKET_LIMITS.maxTotalOdds)
  totalOdds!: number;

  /** Produit des fréquences sans marge ; strictement positif. */
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(VERIFIED_TICKET_LIMITS.minChance)
  @Max(1)
  chance!: number;
}
