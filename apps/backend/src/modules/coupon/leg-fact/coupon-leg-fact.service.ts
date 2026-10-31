import { Injectable } from '@nestjs/common';
import {
  LEG_FACT_HISTORY_DAYS,
  LEG_FACT_HISTORY_MATCHES,
} from '@config/leg-fact.constants';
import { createLogger } from '@utils/logger';
import { legFact, type PastMatch } from './leg-fact';
import { LegFactRepository, type TeamMatchRow } from './leg-fact.repository';

const logger = createLogger('coupon-leg-fact');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Writes the fact under each leg of the day's deterministic coupons
 * (docs/refonte-ui/04 § 1), right after the generation passes. Only legs
 * without one are touched, so a fact is computed once, on the matches
 * played before that moment, and never rewritten. An empty fact means
 * nothing solid was found: the screen shows no sentence.
 *
 * Three queries whatever the number of legs: the legs, the teams'
 * histories, one update.
 */
@Injectable()
export class CouponLegFactService {
  constructor(private readonly repository: LegFactRepository) {}

  async fillForDate(
    forDate: Date,
    now: Date = new Date(),
  ): Promise<{ legs: number; withFact: number }> {
    const legs = await this.repository.findLegsWithoutFact(forDate);
    if (legs.length === 0) return { legs: 0, withFact: 0 };

    const teamIds = [
      ...new Set(legs.flatMap((leg) => [leg.homeTeamId, leg.awayTeamId])),
    ];
    const rows = await this.repository.findTeamHistories({
      teamIds,
      since: new Date(now.getTime() - LEG_FACT_HISTORY_DAYS * DAY_MS),
      before: now,
      perVenue: LEG_FACT_HISTORY_MATCHES,
    });
    const histories = historiesByTeam(rows);

    const facts = legs.map((leg) => ({
      legId: leg.legId,
      fact: legFact({
        market: leg.market,
        pick: leg.pick,
        line: leg.line === null ? null : Number(leg.line),
        home: {
          name: leg.homeName,
          shortName: leg.homeShortName,
          history: histories.get(leg.homeTeamId) ?? [],
        },
        away: {
          name: leg.awayName,
          shortName: leg.awayShortName,
          history: histories.get(leg.awayTeamId) ?? [],
        },
      }),
    }));
    await this.repository.saveFacts(facts);

    const withFact = facts.filter((f) => f.fact !== '').length;
    logger.info({ legs: facts.length, withFact }, 'Leg facts written');
    return { legs: facts.length, withFact };
  }
}

/** Rows come most recent first per team and venue; the order is kept. */
function historiesByTeam(
  rows: readonly TeamMatchRow[],
): Map<string, PastMatch[]> {
  const byTeam = new Map<string, PastMatch[]>();
  for (const row of rows) {
    const history = byTeam.get(row.teamId) ?? [];
    history.push({
      atHome: row.atHome,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      halfTimeFor: row.halfTimeFor,
      halfTimeAgainst: row.halfTimeAgainst,
      corners: row.corners === null ? null : Number(row.corners),
    });
    byTeam.set(row.teamId, history);
  }
  return byTeam;
}
