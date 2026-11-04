import { BadRequestException, Injectable } from '@nestjs/common';
import {
  resolveStatMarketBetStatus,
  type MatchFacts,
} from '@evcore/analysis-core';
import { resolveSelectionFinalResult } from '@modules/betting-engine/channel-selection-settlement';
import Decimal from 'decimal.js';
import {
  type MarketPriceRow,
  type PlayableQuote,
  PlayableOddsRepository,
  playableQuoteKey,
} from '@modules/betting-engine/pricing/playable-odds.repository';
import { STAT_MARKET_SETTLEMENT } from '@modules/coupon/coupon.constants';
import { MatchFactsRepository } from '@modules/fixture-events/match-facts.repository';
import { VerifiedTicketService } from '@modules/verified-ticket/verified-ticket.service';
import { SHEET_PRICES_LOOKBACK_DAYS } from '@config/screens.constants';
import { isSheetNewMarket, quoteNewMarketPick } from './match-sheet-markets';
import { MatchesRepository } from './matches.repository';
import { resultOf } from './matches-reading';
import { TodayService } from './today.service';
import type { TicketLegDto } from './dto/ticket-quote.dto';
import type { TicketQuote, TicketQuoteLeg } from './ticket.types';

const DAY_MS = 86_400_000;

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
    const mainLegs = input.legs
      .filter((leg) => !isSheetNewMarket(leg.market))
      .map(({ fixtureId, market, pick }) => ({ fixtureId, market, pick }));
    const [fixtures, quotes, hero] = await Promise.all([
      this.matches.findTicketFixtures(ids),
      mainLegs.length > 0
        ? this.playableOdds.findPlayableQuotes(mainLegs, { operatorOnly: true })
        : Promise.resolve(new Map<string, PlayableQuote>()),
      this.today.heroOfDay(input.day ? new Date(input.day) : now, now),
    ]);
    const fixtureOf = new Map(fixtures.map((f) => [f.id, f]));
    const newLegs = input.legs.filter((leg) => isSheetNewMarket(leg.market));
    const { rowsOf, factsOf } = await this.readNewMarkets(newLegs, fixtureOf);

    const legs = input.legs.map((leg): TicketQuoteLeg => {
      const fixture = fixtureOf.get(leg.fixtureId);
      const line = leg.line ?? null;
      const priced = isSheetNewMarket(leg.market)
        ? quoteNewMarketPick({
            market: leg.market,
            pick: leg.pick,
            line,
            rows: rowsOf.get(leg.fixtureId) ?? [],
          })
        : null;
      const quote = isSheetNewMarket(leg.market)
        ? null
        : quotes.get(playableQuoteKey(leg));
      return {
        fixtureId: leg.fixtureId,
        market: leg.market,
        pick: leg.pick,
        line,
        kickoffAt: fixture?.scheduledAt.toISOString() ?? null,
        state: !fixture
          ? 'unknown'
          : fixture.status === 'POSTPONED' || fixture.status === 'CANCELLED'
            ? 'postponed'
            : fixture.status !== 'SCHEDULED' ||
                fixture.scheduledAt.getTime() <= now.getTime()
              ? 'started'
              : 'open',
        odds: priced?.odds ?? quote?.operatorOdds ?? null,
        fair: priced ? priced.chance : (quote?.operatorFairProbability ?? null),
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
   * The new markets' bets need every book's prices on their match (one read
   * per match, bounded as the sheet bounds it) and, once it is finished,
   * its facts.
   */
  private async readNewMarkets(
    legs: readonly TicketLegDto[],
    fixtureOf: ReadonlyMap<string, TicketFixture>,
  ): Promise<{
    rowsOf: Map<string, MarketPriceRow[]>;
    factsOf: Map<string, MatchFacts>;
  }> {
    const markets = new Map<string, Set<string>>();
    for (const leg of legs) {
      if (!fixtureOf.has(leg.fixtureId)) continue;
      const set = markets.get(leg.fixtureId) ?? new Set<string>();
      set.add(leg.market);
      markets.set(leg.fixtureId, set);
    }
    const finished = [...markets.keys()].filter(
      (id) => fixtureOf.get(id)?.status === 'FINISHED',
    );
    const [rows, factsOf] = await Promise.all([
      Promise.all(
        [...markets].map(async ([fixtureId, wanted]) => {
          const kickoff = (fixtureOf.get(fixtureId) as TicketFixture)
            .scheduledAt;
          const found = await this.playableOdds.findMarketPrices({
            fixtureId,
            markets: [...wanted],
            kickoff,
            since: new Date(
              kickoff.getTime() - SHEET_PRICES_LOOKBACK_DAYS * DAY_MS,
            ),
          });
          return [fixtureId, found] as const;
        }),
      ),
      finished.length > 0
        ? this.matchFacts.findFacts(finished)
        : Promise.resolve(new Map<string, MatchFacts>()),
    ]);
    return { rowsOf: new Map(rows), factsOf };
  }
}

type TicketFixture = Awaited<
  ReturnType<MatchesRepository['findTicketFixtures']>
>[number];

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
    const status =
      context.facts === null
        ? null
        : resolveStatMarketBetStatus({
            market: leg.market,
            pick: leg.pick,
            line: leg.line ?? null,
            facts: context.facts,
          });
    // Unknown is not lost: we wait, then refund as the coupons do.
    const graceOver =
      context.now.getTime() - fixture.scheduledAt.getTime() >=
      STAT_MARKET_SETTLEMENT.graceDays * DAY_MS;
    return {
      result: status === null ? (graceOver ? 'void' : null) : resultOf(status),
      score,
    };
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
