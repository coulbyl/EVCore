import { Controller, UseGuards } from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';

/**
 * BetController — placeholder conservé pour les futures routes GET /bets.
 * La création des bets USER se fait désormais dans BetSlipService.create()
 * en même temps que le BetSlip, dans une transaction unique.
 */
@Controller('bets')
@UseGuards(AuthSessionGuard)
export class BetController {}
