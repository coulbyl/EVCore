import { BadRequestException, Injectable } from '@nestjs/common';
import type { MatchFacts } from '@evcore/analysis-core';
import { resolveSelectionFinalResult } from '@modules/betting-engine/channel-selection-settlement';
import Decimal from 'decimal.js';
import {
  type MarketPriceRow,
  type PlayableQuote,
  PlayableOddsRepository,
  playableQuoteKey,
} from '@modules/betting-engine/pricing/playable-odds.repository';
import { settleFactLeg } from '@modules/coupon/fact-leg-settlement';
import { MatchFactsRepository } from '@modules/fixture-events/match-facts.repository';
import { VerifiedTicketService } from '@modules/verified-ticket/verified-ticket.service';
import {
  isSheetNewMarket,
  quoteNewMarketPick,
  sheetPriceWindow,
  type SheetNewMarket,
} from './match-sheet-markets';
import { MatchesRepository } from './matches.repository';
import { groupBy, resultOf } from './matches-reading';
import { TodayService } from './today.service';
import type { TicketLegDto } from './dto/ticket-quote.dto';
import type { TicketQuote, TicketQuoteLeg } from './ticket.types';

/** A bet of the new markets, priced and settled on the match facts. */
type FactLeg = TicketLegDto & { market: SheetNewMarket };

/**
 * « Mon ticket » priced now (refonte 07 § 3–4). Every bet is read at its
 * current 1xBet price with the market's frequency without margin (Shin on
 * 1xBet's group, the same as « Autres paris »); a bet of the new markets
 * (corners, cards, scorers, shots, minute) as the sheet prices it, at
 * another book when 1xBet does not. Started or postponed matches leave the
 * figures; the rest multiply, under the independence assumption of the
 * coupons:
 * - odds = Π o, chance = Π p. No bookmaker's margin: shown to the player it
 *   read as running 1xBet down (decided 2026-10-31).
 */
@Injectable()
export class TicketService {
  // eslint-disable-next-line max-params -- NestJS constructor injection: the matches, their prices, the hero, the counter, the facts
  constructor(
    private readonly matches: MatchesRepository,
    private readonly playableOdds: PlayableOddsRepository,
    private readonly today: TodayService,
    private readonly verifiedTickets: VerifiedTicketService,
    private readonly matchFacts: MatchFactsRepository,
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
    // The main markets go to the 1xBet quote, the new markets to every
    // book's prices and, once finished, to the match facts.
    const mainLegs: TicketLegDto[] = [];
    const factLegs: FactLeg[] = [];
    for (const leg of input.legs) {
      if (isSheetNewMarket(leg.market))
        factLegs.push({ ...leg, market: leg.market });
      else mainLegs.push(leg);
    }
    const [fixtures, quotes, hero] = await Promise.all([
      this.matches.findTicketFixtures(ids),
      mainLegs.length > 0
        ? this.playableOdds.findPlayableQuotes(
            mainLegs.map(({ fixtureId, market, pick }) => ({
              fixtureId,
              market,
              pick,
            })),
            { operatorOnly: true },
          )
        : Promise.resolve(new Map<string, PlayableQuote>()),
      this.today.heroOfDay(input.day ? new Date(input.day) : now, now),
    ]);
    const fixtureOf = new Map(fixtures.map((f) => [f.id, f]));
    const { rowsOf, factsOf } = await this.readNewMarkets({
      legs: factLegs,
      fixtureOf,
      now,
    });

    const legs = input.legs.map((leg): TicketQuoteLeg => {
      const fixture = fixtureOf.get(leg.fixtureId);
      const line = leg.line ?? null;
      let price: Pick<TicketQuoteLeg, 'odds' | 'fair'>;
      if (isSheetNewMarket(leg.market)) {
        const priced = quoteNewMarketPick({
          market: leg.market,
          pick: leg.pick,
          line,
          rows: rowsOf.get(leg.fixtureId) ?? [],
        });
        price = { odds: priced?.odds ?? null, fair: priced?.chance ?? null };
      } else {
        const quote = quotes.get(playableQuoteKey(leg));
        price = {
          odds: quote?.operatorOdds ?? null,
          fair: quote?.operatorFairProbability ?? null,
        };
      }
      return {
        fixtureId: leg.fixtureId,
        market: leg.market,
        pick: leg.pick,
        line,
        kickoffAt: fixture?.scheduledAt.toISOString() ?? null,
        state: stateOf(fixture, now),
        ...price,
        ...settlementOf(leg, fixture, {
          facts: factsOf.get(leg.fixtureId) ?? null,
          now,
        }),
      };
    });

    const totals = totalsOf(legs);
    // An unknown chance is not counted: the count keeps figures only.
    if (input.verify && totals && totals.chance !== null) {
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
                  // Final only: the ticket has no clock to tell a live score.
                  score:
                    single.clock?.kind === 'finished' ? single.score : null,
                }
              : null,
          }
        : null,
      quotedAt: now.toISOString(),
    };
  }

  /**
   * The new markets' bets need every book's prices on their match while it
   * is still to play (one read for every match, each bounded as the sheet
   * bounds it) and, once it is finished, its facts.
   */
  private async readNewMarkets(input: {
    legs: readonly FactLeg[];
    fixtureOf: ReadonlyMap<string, TicketFixture>;
    now: Date;
  }): Promise<{
    rowsOf: Map<string, MarketPriceRow[]>;
    factsOf: Map<string, MatchFacts>;
  }> {
    const withFixture = input.legs.flatMap((leg) => {
      const fixture = input.fixtureOf.get(leg.fixtureId);
      return fixture ? [{ leg, fixture }] : [];
    });
    const open = withFixture.filter(
      ({ fixture }) => stateOf(fixture, input.now) === 'open',
    );
    const finished = withFixture
      .filter(({ fixture }) => fixture.status === 'FINISHED')
      .map(({ fixture }) => fixture.id);
    const [rows, factsOf] = await Promise.all([
      this.playableOdds.findMarketPrices({
        fixtures: open.map(({ fixture }) =>
          sheetPriceWindow(fixture.id, fixture.scheduledAt),
        ),
        markets: [...new Set(open.map(({ leg }) => leg.market))],
      }),
      finished.length > 0
        ? this.matchFacts.findFacts(finished)
        : Promise.resolve(new Map<string, MatchFacts>()),
    ]);
    return { rowsOf: groupBy(rows, (row) => row.fixtureId), factsOf };
  }
}

type TicketFixture = Awaited<
  ReturnType<MatchesRepository['findTicketFixtures']>
>[number];

/** Open until kick-off; a postponed or cancelled match leaves the figures. */
function stateOf(
  fixture: TicketFixture | undefined,
  now: Date,
): TicketQuoteLeg['state'] {
  if (!fixture) return 'unknown';
  if (fixture.status === 'POSTPONED' || fixture.status === 'CANCELLED') {
    return 'postponed';
  }
  return fixture.status !== 'SCHEDULED' ||
    fixture.scheduledAt.getTime() <= now.getTime()
    ? 'started'
    : 'open';
}

/**
 * A bet of the ticket once its match is over (07 § 6), by the rules that
 * settle the engine's selections (and the bets they mirror); a bet of the
 * new markets on the match's facts, by the resolvers of the coupons. A
 * postponed or cancelled match is void, as a bookmaker voids the leg.
 * Recomputed on every quote: nothing is stored, a late fact grades it.
 */
export function settlementOf(
  leg: TicketLegDto,
  fixture: TicketFixture | undefined,
  context: { facts: MatchFacts | null; now: Date },
): Pick<TicketQuoteLeg, 'result' | 'score'> {
  // A match the server no longer knows cannot be played: void, as 1xBet
  // voids a leg it cannot settle, rather than pending forever.
  if (!fixture) return { result: 'void', score: null };
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
  const score = { home: fixture.homeScore, away: fixture.awayScore };
  if (isSheetNewMarket(leg.market)) {
    // Unknown is not lost: we wait, then refund as the coupons do.
    const status = settleFactLeg({
      market: leg.market,
      pick: leg.pick,
      line: leg.line ?? null,
      facts: context.facts,
      kickoff: fixture.scheduledAt,
      now: context.now,
    });
    return { result: status === null ? null : resultOf(status), score };
  }
  const status = resolveSelectionFinalResult(
    { market: leg.market, pick: leg.pick },
    {
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
      homeHtScore: fixture.homeHtScore,
      awayHtScore: fixture.awayHtScore,
    },
  );
  return { result: resultOf(status), score };
}

/**
 * The figures over the open legs priced now (07 § 4), all on the same
 * legs: the chance is unknown when one of them has no frequency (a scorer),
 * never computed on the others alone.
 */
export function totalsOf(
  legs: readonly TicketQuoteLeg[],
): TicketQuote['totals'] {
  const counted = legs.filter(
    (leg) => leg.state === 'open' && leg.odds !== null,
  );
  if (counted.length === 0) return null;
  let odds = new Decimal(1);
  let chance: Decimal | null = new Decimal(1);
  for (const leg of counted) {
    odds = odds.times(new Decimal(leg.odds as number));
    chance =
      chance === null || leg.fair === null
        ? null
        : chance.times(new Decimal(leg.fair));
  }
  return {
    legCount: counted.length,
    odds: odds.toDecimalPlaces(3).toNumber(),
    chance: chance === null ? null : chance.toDecimalPlaces(10).toNumber(),
  };
}
