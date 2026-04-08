import { Injectable } from '@nestjs/common';
import { createLogger } from '@utils/logger';
import { FixtureRepository } from './fixture.repository';

const logger = createLogger('match-leg-detection-service');

/**
 * Infers aller/retour legs for knockout rounds in UEFA competitions.
 *
 * API-Football does not expose a `leg` field — the round string is identical
 * for both legs (e.g. "Quarter-finals"). Detection works by finding pairs of
 * fixtures that share the same two teams within a season + round, then assigning
 * leg=1 to the earlier fixture and leg=2 to the later one.
 *
 * Aggregate scores (going into leg 2) are derived from leg 1's result.
 */
@Injectable()
export class MatchLegDetectionService {
  constructor(private readonly fixtureRepository: FixtureRepository) {}

  /**
   * Detect and persist leg assignments for all knockout rounds in a season.
   * Safe to call repeatedly — already-assigned legs are skipped.
   *
   * @returns Number of fixtures updated.
   */
  async detectLegsForSeason(seasonId: string): Promise<number> {
    const rounds =
      await this.fixtureRepository.findKnockoutRoundsBySeasonId(seasonId);

    if (rounds.length === 0) return 0;

    let updated = 0;

    for (const { round } of rounds) {
      const count = await this.detectLegsForRound(seasonId, round);
      updated += count;
    }

    logger.info({ seasonId, updated }, 'Leg detection complete for season');
    return updated;
  }

  private async detectLegsForRound(
    seasonId: string,
    round: string,
  ): Promise<number> {
    const fixtures =
      await this.fixtureRepository.findKnockoutFixturesBySeasonAndRound(
        seasonId,
        round,
      );

    // Skip if all legs are already assigned
    if (fixtures.every((f) => f.leg !== null)) return 0;

    // Build pairs: match fixture A (home: X, away: Y) with fixture B (home: Y, away: X)
    const pairs = buildMatchupPairs(fixtures);
    let updated = 0;

    for (const [leg1, leg2] of pairs) {
      const needsUpdate = leg1.leg === null || leg2.leg === null;
      if (!needsUpdate) continue;

      await Promise.all([
        this.fixtureRepository.setFixtureLeg(leg1.id, 1, null),
        this.fixtureRepository.setFixtureLeg(leg2.id, 2, {
          // From leg2's perspective:
          // - The home team in leg2 was away in leg1 → their leg1 goals = leg1.awayScore
          // - The away team in leg2 was home in leg1 → their leg1 goals = leg1.homeScore
          homeGoals: leg1.awayScore,
          awayGoals: leg1.homeScore,
        }),
      ]);

      updated += 2;
    }

    if (updated > 0) {
      logger.info({ seasonId, round, updated }, 'Legs assigned for round');
    }

    return updated;
  }
}

type KnockoutFixture = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: Date;
  homeScore: number | null;
  awayScore: number | null;
  leg: number | null;
};

/**
 * Finds pairs of fixtures where teams are swapped (aller/retour pattern).
 * Returns pairs sorted chronologically: [leg1, leg2].
 */
function buildMatchupPairs(
  fixtures: KnockoutFixture[],
): [KnockoutFixture, KnockoutFixture][] {
  const pairs: [KnockoutFixture, KnockoutFixture][] = [];
  const used = new Set<string>();

  for (const f1 of fixtures) {
    if (used.has(f1.id)) continue;

    const f2 = fixtures.find(
      (f) =>
        !used.has(f.id) &&
        f.id !== f1.id &&
        f.homeTeamId === f1.awayTeamId &&
        f.awayTeamId === f1.homeTeamId,
    );

    if (!f2) continue;

    used.add(f1.id);
    used.add(f2.id);

    // Sort chronologically: earlier = leg 1
    const [leg1, leg2] = f1.scheduledAt <= f2.scheduledAt ? [f1, f2] : [f2, f1];

    pairs.push([leg1, leg2]);
  }

  return pairs;
}
