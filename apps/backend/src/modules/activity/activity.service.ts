import { Injectable } from '@nestjs/common';
import { type Prisma, ProductEventType } from '@evcore/db';
import { createLogger } from '@utils/logger';
import { ActivityRepository } from './activity.repository';

const logger = createLogger('activity');

/** Au-delà, le cache repart de zéro (un jour suffit, il est daté). */
const MAX_CACHED = 50_000;

/**
 * Mesure d'activité chez nous, sans outil tiers (2026-10-29) : un jour actif
 * par joueur et par jour, écrit à la première requête authentifiée du jour.
 * Le cache mémoire évite une écriture par requête ; un échec est journalisé
 * et ne bloque jamais la requête du joueur.
 */
@Injectable()
export class ActivityService {
  private readonly seen = new Set<string>();

  constructor(private readonly repository: ActivityRepository) {}

  touch(userId: string, now: Date = new Date()): void {
    const day = now.toISOString().slice(0, 10);
    const key = `${userId}|${day}`;
    if (this.seen.has(key)) return;
    if (this.seen.size >= MAX_CACHED) this.seen.clear();
    this.seen.add(key);
    this.repository
      .recordActiveDay(userId, new Date(`${day}T00:00:00.000Z`))
      .catch((error: unknown) => {
        // On réessaiera à la prochaine requête.
        this.seen.delete(key);
        logger.warn(
          {
            userId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Active day not recorded',
        );
      });
  }

  async recordEvent(input: {
    userId: string;
    type: ProductEventType;
    payload?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.repository.recordEvent(input);
  }
}
