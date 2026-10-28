import { BadRequestException, Injectable } from '@nestjs/common';
import type { PauseDurationDays } from '@config/pause.constants';
import { createLogger } from '@utils/logger';
import { AccountRepository } from './account.repository';

const logger = createLogger('account-pause');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pause en libre-service (jeu responsable, décision du 2026-10-28). Une
 * pause qu'on lève en deux clics se lève au premier coup de tête : elle ne
 * peut donc qu'être prolongée, jamais raccourcie ni annulée avant sa fin.
 */
@Injectable()
export class AccountPauseService {
  constructor(private readonly repository: AccountRepository) {}

  async pause(
    userId: string,
    days: PauseDurationDays,
    now: Date = new Date(),
  ): Promise<{ pausedUntil: string }> {
    const current = await this.repository.findPausedUntil(userId);
    const requested = new Date(now.getTime() + days * DAY_MS);
    const currentEnd = current?.pausedUntil ?? null;
    if (currentEnd && currentEnd.getTime() >= requested.getTime()) {
      throw new BadRequestException(
        'Ta pause dure déjà au moins jusque-là : elle ne peut que se prolonger.',
      );
    }
    await this.repository.setPausedUntil(userId, requested);
    logger.info({ userId, days }, 'Account paused by its owner');
    return { pausedUntil: requested.toISOString() };
  }
}
