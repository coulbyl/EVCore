import { BadRequestException, Injectable } from '@nestjs/common';
import { BetStatus, type Market } from '@evcore/db';
import { resolveSelectionFinalResult } from '@modules/betting-engine/channel-selection-settlement';
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
    input: { legs: readonly TicketLegDto[]; verify?: boolean; day?: string },
    now: Date = new Date(),
  ): Promise<TicketQuote> {
    const ids = input.legs.map((leg) => leg.fixtureId);
    // Two bets of one match are correlated, and 1xBet refuses them too:
    // the device keeps one per match (07 § 4).
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('One bet per match.');
    }
    const [fixtures, quotes, hero] = await Promise.all([
      this.matches.findTicketFixtures(ids),
      this.playableOdds.findPlayableQuotes(input.legs, { operatorOnly: true }),
      this.today.heroOfDay(input.day ? new Date(input.day) : now, now),
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
        ...settlementOf(leg, fixture),
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

    const single = hero?.legs.length === 1 ? hero.legs[0] : undefined;
    return {
      legs,
      totals,
      hero: hero
        ? {
            couponId: hero.id,
            product: hero.product,
            chance: hero.chance,
            state: hero.state,
            odds: hero.paidOdds ?? hero.odds,
            match: single
              ? {
                  home: single.home.name,
                  away: single.away.name,
                  score: single.score,
                }
              : null,
          }
        : null,
      quotedAt: now.toISOString(),
    };
  }
}

type TicketFixture = Awaited<
  ReturnType<MatchesRepository['findTicketFixtures']>
>[number];

/**
 * A bet of the ticket once its match is over (07 § 6), by the rules that
 * settle the engine's selections (and the bets they mirror). A postponed or
 * cancelled match is void, as a bookmaker voids the leg.
 */
export function settlementOf(
  leg: TicketLegDto,
  fixture: TicketFixture | undefined,
): Pick<TicketQuoteLeg, 'result' | 'score'> {
  if (!fixture) return { result: null, score: null };
  if (fixture.status === 'POSTPONED' || fixture.status === 'CANCELLED') {
    return { result: 'void', score: null };
  }
  if (
    fixture.status !== 'FINISHED' ||
    fixture.homeScore === null ||
    fixture.awayScore === null
  ) {
    return { result: null, score: null };
  }
  const status = resolveSelectionFinalResult(
    { market: leg.market as Market, pick: leg.pick },
    {
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
      homeHtScore: fixture.homeHtScore,
      awayHtScore: fixture.awayHtScore,
    },
  );
  return {
    result:
      status === BetStatus.WON
        ? 'won'
        : status === BetStatus.LOST
          ? 'lost'
          : status === BetStatus.VOID
            ? 'void'
            : null,
    score: { home: fixture.homeScore, away: fixture.awayScore },
  };
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
