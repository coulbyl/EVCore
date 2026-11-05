import { Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { CouponSource } from '@evcore/db';
import {
  AI_COMBO_COUPON_CLASS,
  BTTS_HUNTER,
  CORNERS_HUNTER,
  DRAW_HUNTER,
  HT_DRAW_HUNTER,
  SCORE_HUNTER,
  composeAiCombo,
  composeCornersHunter,
  composeHunterByMarket,
  composeScoreHunter,
  priceCornersSides,
  type AiComboCandidate,
  type HunterComposition,
  type HunterSpec,
  type Market,
} from '@evcore/analysis-core';
import { CouponRepository } from './coupon.repository';
import { PlayableOddsRepository } from '../betting-engine/pricing/playable-odds.repository';
import {
  operatorPrice,
  playableAtOperator,
} from '../betting-engine/pricing/playable-odds.filter';
import {
  playableQuoteKey,
  type PlayableQuote,
} from '../betting-engine/pricing/playable-odds.repository';
import {
  AI_COMBO_POLICY,
  CORNERS_HUNTER_POLICY,
  ENGINE_COMBO_POLICY,
  HUNTER_POLICY,
} from './coupon.constants';
import {
  CouponPricedPoolService,
  type PricedPool,
} from './coupon-priced-pool.service';

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;

export type HunterPassOutcome = {
  hunter: string;
  /** `deferred` : le Combiné IA attend la passe de 21 h (rien d'écrit). */
  outcome: 'composed' | 'abstained' | 'deferred';
  candidateCount: number;
};

/**
 * Chasseurs du jour, montrés aux joueurs comme les autres coupons
 * (2026-10-28) : BTTS « oui », Nul et Nul à la mi-temps (2026-11-04)
 * classés par le prix (source PRICE_COMPOSER), Score exact pris parmi les scores retenus par le moteur
 * (source ENGINE). Une sélection par chasseur ou l'abstention, enregistrée.
 */
@Injectable()
export class CouponHunterGenerationService {
  private readonly logger = new Logger(CouponHunterGenerationService.name);

  constructor(
    private readonly repository: CouponRepository,
    private readonly playableOdds: PlayableOddsRepository,
    private readonly pricedPool: CouponPricedPoolService,
  ) {}

  /** `pool` : le vivier déjà chargé par la génération du soir, sinon relu. */
  async generateForDate(
    forDate: Date,
    pool?: PricedPool,
  ): Promise<HunterPassOutcome[]> {
    const priced = pool ?? (await this.pricedPool.load(forDate));
    const { dayStart } = priced;
    const range = { from: dayStart, to: new Date(dayStart.getTime() + DAY_MS) };
    // Le 1X2 de la mi-temps a son propre vivier : s'il ne se charge pas,
    // seul le Chasseur Nul à la mi-temps manque, les autres sortent.
    const [halfTime, engineRows, avoidedIds] = await Promise.all([
      this.pricedPool
        .loadMarket(dayStart, HT_DRAW_HUNTER.market)
        .catch((error: unknown) => {
          this.logger.error(
            `Vivier mi-temps non chargé : ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          return null;
        }),
      this.repository.findEngineComboCandidates({
        ...range,
        excludedChannels: ENGINE_COMBO_POLICY.excludedChannels,
      }),
      // Les matchs que le méta-canal AVOID signale sont écartés des
      // chasseurs (plan du 23/10, reste de revue du lot 2).
      this.repository.findAvoidedFixtureIds(range),
    ]);
    const scoreRows = engineRows.filter(
      (r) => r.market === SCORE_HUNTER.market,
    );
    const scoreQuotes = await this.playableOdds.findPlayableQuotes(
      scoreRows.map((r) => ({
        fixtureId: r.fixtureId,
        market: r.market,
        pick: r.pick,
      })),
    );
    const scoreCandidates = scoreRows
      .filter((r) => playableAtOperator(r, scoreQuotes))
      .map((r) => {
        const quote = scoreQuotes.get(playableQuoteKey(r));
        return {
          ...r,
          playableOdds: quote?.operatorOdds ?? quote?.lowestOdds ?? r.odds,
        };
      });
    const avoided = new Set(avoidedIds);
    // Un match signalé reste dans son groupe (pour la marge) mais ne peut
    // plus devenir une jambe.
    const playable = (
      pool: PricedPool,
      excluded: ReadonlySet<string> = avoided,
    ) =>
      pool.candidates.map((c) =>
        excluded.has(c.fixtureId) ? { ...c, playableOdds: 0 } : c,
      );
    const marketCandidates = playable(priced);
    const quotes = new Map([
      ...priced.quotes,
      ...(halfTime?.quotes ?? []),
      ...scoreQuotes,
    ]);
    const kickoffs = new Map(
      [...priced.rows, ...(halfTime?.rows ?? []), ...scoreRows].map((r) => [
        r.fixtureId,
        r.scheduledAt,
      ]),
    );
    const context = { dayStart, kickoffs, quotes };

    return [
      await this.persist({
        ...context,
        spec: BTTS_HUNTER,
        source: CouponSource.PRICE_COMPOSER,
        composition: composeHunterByMarket(marketCandidates, BTTS_HUNTER),
      }),
      // Nul et Score exact jamais sur le même match le même jour (05/11) :
      // un 1:1 est aussi un nul, les deux perdent ensemble. Le Nul écarte le
      // match du Score exact déjà publié, le Score exact celui du Nul publié
      // (la proposition du jour est immuable : on lit celle qui est publiée,
      // pas la composition de cette passe).
      await this.persist({
        ...context,
        spec: DRAW_HUNTER,
        source: CouponSource.PRICE_COMPOSER,
        composition: composeHunterByMarket(
          playable(
            priced,
            new Set([
              ...avoided,
              ...(await this.publishedFixtureIds(
                dayStart,
                SCORE_HUNTER,
                CouponSource.ENGINE,
              )),
            ]),
          ),
          DRAW_HUNTER,
        ),
      }),
      ...(halfTime
        ? [
            await this.persist({
              ...context,
              spec: HT_DRAW_HUNTER,
              source: CouponSource.PRICE_COMPOSER,
              composition: composeHunterByMarket(
                playable(halfTime),
                HT_DRAW_HUNTER,
              ),
            }),
          ]
        : []),
      await this.persist({
        ...context,
        spec: SCORE_HUNTER,
        source: CouponSource.ENGINE,
        composition: composeScoreHunter(
          await this.withoutFixtures(
            scoreCandidates.filter((c) => !avoided.has(c.fixtureId)),
            this.publishedFixtureIds(
              dayStart,
              DRAW_HUNTER,
              CouponSource.PRICE_COMPOSER,
            ),
          ),
        ),
      }),
      await this.persistCorners({ dayStart, avoided }),
      await this.persistAiCombo({ dayStart, avoided }),
    ];
  }

  private async withoutFixtures<T extends { fixtureId: string }>(
    candidates: readonly T[],
    excluded: Promise<ReadonlySet<string>>,
  ): Promise<T[]> {
    const ids = await excluded;
    return candidates.filter((c) => !ids.has(c.fixtureId));
  }

  /** Les matchs du coupon publié d'un chasseur pour le jour. */
  private async publishedFixtureIds(
    dayStart: Date,
    spec: HunterSpec,
    source: CouponSource,
  ): Promise<Set<string>> {
    return new Set(
      await this.repository.findProposalFixtureIds({
        forDate: dayStart,
        source,
        targetOddsMin: spec.coupon.targetOddsMin,
      }),
    );
  }

  /**
   * Combiné IA (2026-11-03) : trois ou quatre avis joués par l'IA sur les
   * matchs du jour, au prix 1xBet de 1,45 à 1,80, un par championnat, les
   * moins chers d'abord, cote combinée 4 à 10 ; hors matchs AVOID et
   * « Données suspectes » (lus par `findAiPlays`). Composé à la passe de
   * 21 h, après celle de l'IA (AI_COMBO_POLICY.composeFromHoursBeforeDay). Un avis
   * sans fréquence du marché chez 1xBet (groupe incomplet) n'entre pas : sa
   * chance serait inconnue.
   */
  private async persistAiCombo(input: {
    dayStart: Date;
    avoided: ReadonlySet<string>;
  }): Promise<HunterPassOutcome> {
    const { dayStart } = input;
    const opensAt =
      dayStart.getTime() - AI_COMBO_POLICY.composeFromHoursBeforeDay * HOUR_MS;
    if (Date.now() < opensAt) {
      // La passe de 17 h n'écrit rien : ni coupon, ni abstention, que la
      // passe de 21 h remplacerait de toute façon.
      return {
        hunter: AI_COMBO_COUPON_CLASS.name,
        outcome: 'deferred',
        candidateCount: 0,
      };
    }
    const plays = (
      await this.repository.findAiPlays({
        from: dayStart,
        to: new Date(dayStart.getTime() + DAY_MS),
      })
    ).filter((p) => !input.avoided.has(p.fixtureId));
    const quotes = await this.playableOdds.findPlayableQuotes(
      plays.map((p) => ({
        fixtureId: p.fixtureId,
        market: p.market,
        pick: p.pick,
      })),
      { operatorOnly: true },
    );
    const candidates: AiComboCandidate[] = plays.flatMap((p) => {
      const quote = quotes.get(playableQuoteKey(p));
      return quote?.operatorOdds != null &&
        quote.operatorFairProbability != null
        ? [
            {
              fixtureId: p.fixtureId,
              competition: p.competition,
              market: p.market,
              pick: p.pick,
              operatorOdds: quote.operatorOdds,
              operatorMargin: quote.operatorMargin,
              probability: quote.operatorFairProbability,
            },
          ]
        : [];
    });
    const composition = composeAiCombo(candidates);
    const pass = {
      name: 'ai-combo',
      policyVersion: AI_COMBO_POLICY.version,
    };
    const base = {
      hunter: AI_COMBO_COUPON_CLASS.name,
      candidateCount: composition.candidateCount,
    };
    if (composition.outcome === 'abstained') {
      await this.repository.recordPriceComposerAttempt({
        forDate: dayStart,
        outcome: 'abstained',
        candidateCount: composition.candidateCount,
        reason: composition.reason,
        pass,
      });
      return { ...base, outcome: 'abstained' };
    }
    const kickoffs = new Map(plays.map((p) => [p.fixtureId, p.scheduledAt]));
    // Fréquence du marché × cote : la chance affichée au joueur.
    const expectedReturn = new Decimal(composition.jointProbability)
      .times(composition.combinedOdds)
      .toNumber();
    const lastKickoff = Math.max(
      ...composition.legs.map(
        (leg) => kickoffs.get(leg.fixtureId)?.getTime() ?? dayStart.getTime(),
      ),
    );
    const { proposalId, created } =
      await this.repository.upsertPriceComposerProposal({
        forDate: dayStart,
        combinedOdds: composition.combinedOdds,
        expectedReturn,
        lastFixtureScheduledAt: new Date(lastKickoff),
        legs: composition.legs.map((leg) => ({
          fixtureId: leg.fixtureId,
          market: leg.market as Market,
          pick: leg.pick,
          line: null,
          odds: leg.operatorOdds,
          expectedReturn: new Decimal(leg.probability)
            .times(leg.operatorOdds)
            .toNumber(),
          probability: leg.probability,
          ...operatorPrice(leg, quotes),
        })),
        profile: {
          source: CouponSource.PRICE_COMPOSER,
          targetOddsMin: AI_COMBO_COUPON_CLASS.targetOddsMin,
          targetOddsMax: AI_COMBO_COUPON_CLASS.targetOddsMax,
          policyVersion: AI_COMBO_POLICY.version,
        },
      });
    await this.repository.recordPriceComposerAttempt({
      forDate: dayStart,
      outcome: created ? 'composed' : 'preserved',
      candidateCount: composition.candidateCount,
      proposalId,
      pass,
    });
    this.logger.log(
      `Combiné IA ${dayStart.toISOString().slice(0, 10)} : ` +
        `${composition.legs.length} jambes à ${composition.combinedOdds}`,
    );
    return { ...base, outcome: 'composed' };
  }

  /**
   * Chasseur Corners (lot 6) : les lignes de corners cotées par 1xBet sur
   * les matchs du jour, dans les championnats aux stats fiables (le pari se
   * règle sur elles), hors matchs AVOID ; le côté le moins cher.
   */
  private async persistCorners(input: {
    dayStart: Date;
    avoided: ReadonlySet<string>;
  }): Promise<HunterPassOutcome> {
    const { dayStart } = input;
    const policy = CORNERS_HUNTER_POLICY;
    const [quotes, reliable] = await Promise.all([
      this.repository.findCornersQuotes({
        from: dayStart,
        to: new Date(dayStart.getTime() + DAY_MS),
        bookmakers: [policy.operatorBookmaker, policy.referenceBookmaker],
      }),
      this.repository.findReliableCornerCompetitions({
        since: new Date(dayStart.getTime() - policy.statsWindowDays * DAY_MS),
        until: new Date(dayStart.getTime() - policy.statsSettleDays * DAY_MS),
        minShare: policy.statsMinShare,
        minFixtures: policy.statsMinFixtures,
      }),
    ]);
    const reliableSet = new Set(reliable);
    const playable = quotes.filter(
      (q) =>
        reliableSet.has(q.competitionId) && !input.avoided.has(q.fixtureId),
    );
    const kickoffs = new Map(quotes.map((q) => [q.fixtureId, q.scheduledAt]));
    // Raisons distinctes : 1xBet ne cote aucun corner (ou pas encore
    // collecté), ou seulement dans des championnats sans stats.
    const operatorPriced = quotes.some(
      (q) => q.bookmaker === policy.operatorBookmaker,
    );
    const abstain = (
      reason: 'no_reliable_competition' | 'no_operator_price',
    ): HunterComposition => ({
      outcome: 'abstained',
      reason,
      candidateCount: 0,
    });
    const composition = !operatorPriced
      ? abstain('no_operator_price')
      : !playable.some((q) => q.bookmaker === policy.operatorBookmaker)
        ? abstain('no_reliable_competition')
        : composeCornersHunter(
            priceCornersSides(
              playable,
              policy.operatorBookmaker,
              policy.referenceBookmaker,
            ),
          );
    return this.persist({
      dayStart,
      spec: CORNERS_HUNTER,
      source: CouponSource.PRICE_COMPOSER,
      composition,
      kickoffs,
      quotes: new Map(),
    });
  }

  private async persist(input: {
    dayStart: Date;
    spec: HunterSpec;
    source: CouponSource;
    composition: HunterComposition;
    kickoffs: ReadonlyMap<string, Date>;
    quotes: Map<string, PlayableQuote>;
  }): Promise<HunterPassOutcome> {
    const { dayStart, spec, composition } = input;
    const pass = {
      name: `hunter-${spec.coupon.name.toLowerCase()}`,
      policyVersion: HUNTER_POLICY.version,
    };
    const base = {
      hunter: spec.coupon.name,
      candidateCount: composition.candidateCount,
    };
    if (composition.outcome === 'abstained') {
      await this.repository.recordPriceComposerAttempt({
        forDate: dayStart,
        outcome: 'abstained',
        candidateCount: composition.candidateCount,
        reason: composition.reason,
        pass,
      });
      return { ...base, outcome: 'abstained' };
    }

    const { leg } = composition;
    // Probabilité du marché × cote : jointProbability retombe sur la
    // fréquence du marché, celle affichée au joueur.
    const expectedReturn = new Decimal(leg.probability)
      .times(leg.odds)
      .toNumber();
    const { proposalId, created } =
      await this.repository.upsertPriceComposerProposal({
        forDate: dayStart,
        combinedOdds: leg.odds,
        expectedReturn,
        lastFixtureScheduledAt: input.kickoffs.get(leg.fixtureId) ?? dayStart,
        legs: [
          {
            fixtureId: leg.fixtureId,
            market: leg.market as Market,
            pick: leg.pick,
            line: leg.line ?? null,
            odds: leg.odds,
            expectedReturn,
            probability: leg.probability,
            // Le chasseur Corners connaît déjà son prix 1xBet ; les autres le
            // lisent dans les prix jouables.
            ...(leg.operatorOdds != null
              ? {
                  operatorOdds: leg.operatorOdds,
                  operatorMargin: leg.operatorMargin ?? null,
                  operatorFairProbability: leg.operatorFairProbability ?? null,
                }
              : operatorPrice(leg, input.quotes)),
          },
        ],
        profile: {
          source: input.source,
          targetOddsMin: spec.coupon.targetOddsMin,
          targetOddsMax: spec.coupon.targetOddsMax,
          policyVersion: HUNTER_POLICY.version,
        },
      });
    await this.repository.recordPriceComposerAttempt({
      forDate: dayStart,
      // The proposal of the day is immutable: a later pass that finds it
      // published says so instead of « composed » (ENV-PROD § 3).
      outcome: created ? 'composed' : 'preserved',
      candidateCount: composition.candidateCount,
      proposalId,
      pass,
    });
    this.logger.log(
      `Chasseur ${spec.coupon.name} ${dayStart.toISOString().slice(0, 10)} : ` +
        `${leg.market}/${leg.pick}${leg.line != null ? ` ${leg.line}` : ''} à ${leg.odds}`,
    );
    return { ...base, outcome: 'composed' };
  }
}
