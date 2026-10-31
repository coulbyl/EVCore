import { BadRequestException, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import {
  PlayableOddsRepository,
  playableQuoteKey,
} from '@modules/betting-engine/pricing/playable-odds.repository';
import { VerifiedTicketService } from '@modules/verified-ticket/verified-ticket.service';
import { MatchesRepository } from './matches.repository';
import { TodayService } from './today.service';
import type { TicketLegDto } from './dto/ticket-quote.dto';
import type { TicketQuote, TicketQuoteLeg } from './ticket.types';

/**
 * « Mon ticket » priced now (refonte 07 § 3–4). Every bet is read at its
 * current 1xBet price with the market's frequency without margin (Shin on
 * 1xBet's group, the same as « Autres paris »). Started or postponed matches
 * leave the figures; the rest multiply, under the independence assumption
 * of the coupons:
 * - odds = Π o, chance = Π p, keep = 1 − Π (p × o).
 */
@Injectable()
export class TicketService {
  // eslint-disable-next-line max-params -- NestJS constructor injection: the matches, their prices, the hero, the counter
  constructor(
    private readonly matches: MatchesRepository,
    private readonly playableOdds: PlayableOddsRepository,
    private readonly today: TodayService,
    private readonly verifiedTickets: VerifiedTicketService,
  ) {}

  async quote(
    input: { legs: readonly TicketLegDto[]; verify?: boolean },
    now: Date = new Date(),
  ): Promise<TicketQuote> {
    const ids = input.legs.map((leg) => leg.fixtureId);
    // Two bets of one match are correlated, and 1xBet refuses them too:
    // the device keeps one per match (07 § 4).
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('One bet per match.');
    }
    const [fixtures, quotes, today] = await Promise.all([
      this.matches.findTicketFixtures(ids),
      this.playableOdds.findPlayableQuotes(input.legs, { operatorOnly: true }),
      this.today.getToday(null, now),
    ]);
    const fixtureOf = new Map(fixtures.map((f) => [f.id, f]));

    const legs = input.legs.map((leg): TicketQuoteLeg => {
      const fixture = fixtureOf.get(leg.fixtureId);
      const quote = quotes.get(playableQuoteKey(leg));
      return {
        fixtureId: leg.fixtureId,
        market: leg.market,
        pick: leg.pick,
        kickoffAt: fixture?.scheduledAt.toISOString() ?? null,
        state: !fixture
          ? 'unknown'
          : fixture.status === 'POSTPONED' || fixture.status === 'CANCELLED'
            ? 'postponed'
            : fixture.status !== 'SCHEDULED' ||
                fixture.scheduledAt.getTime() <= now.getTime()
              ? 'started'
              : 'open',
        odds: quote?.operatorOdds ?? null,
        fair: quote?.operatorFairProbability ?? null,
      };
    });

    const totals = totalsOf(legs);
    if (input.verify && totals) {
      await this.verifiedTickets.record(
        {
          legCount: totals.legCount,
          totalOdds: totals.odds,
          chance: totals.chance,
        },
        now,
      );
    }

    const hero = today.coupons.find((c) => c.id === today.heroId);
    return {
      legs,
      totals,
      hero: hero
        ? { couponId: hero.id, product: hero.product, chance: hero.chance }
        : null,
      quotedAt: now.toISOString(),
    };
  }
}

/** The three figures over the open legs priced now (07 § 4). */
export function totalsOf(
  legs: readonly TicketQuoteLeg[],
): TicketQuote['totals'] {
  const counted = legs.filter(
    (leg) => leg.state === 'open' && leg.odds !== null && leg.fair !== null,
  );
  if (counted.length === 0) return null;
  let odds = new Decimal(1);
  let chance = new Decimal(1);
  let paid = new Decimal(1);
  for (const leg of counted) {
    const o = new Decimal(leg.odds as number);
    const p = new Decimal(leg.fair as number);
    odds = odds.times(o);
    chance = chance.times(p);
    paid = paid.times(p.times(o));
  }
  return {
    legCount: counted.length,
    odds: odds.toDecimalPlaces(3).toNumber(),
    chance: chance.toDecimalPlaces(10).toNumber(),
    keep: new Decimal(1).minus(paid).toDecimalPlaces(4).toNumber(),
  };
}
