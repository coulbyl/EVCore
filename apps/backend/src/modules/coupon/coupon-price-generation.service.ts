import { Injectable, Logger } from '@nestjs/common';
import {
  composeByPrice,
  UNIFIED_COUPON_BOUNDS,
  UNIFIED_COUPON_CLASS,
  type Market,
  type PriceCandidate,
} from '@evcore/analysis-core';
import {
  CouponRepository,
  type MarketCostCell,
  type PriceCandidateRow,
} from './coupon.repository';
import { PRICE_COMPOSER_POLICY } from './coupon.constants';
import { startOfUtcDay } from '@utils/date.utils';

export type PriceGenerationOutcome =
  | { outcome: 'composed'; proposalId: string; candidateCount: number }
  | { outcome: 'abstained'; reason: string; candidateCount: number };

/** Moyenne et variance agrégeables d'une cellule ou d'un marché entier. */
type Aggregate = { legCount: number; mean: number; meanOfSquares: number };

/**
 * Génère le coupon du jour à partir du seul prix.
 *
 * Il tourne EN PARALLÈLE du générateur LLM (apps/vantage-worker) et vise la
 * même cote, pour que les deux soient comparables jambe à jambe. Rien de ce
 * qu'il lit ne vient d'une probabilité produite par le moteur : trois mesures
 * l'interdisent — le moteur est derrière le marché de 0,04 de Brier et son
 * poids optimal dans un mélange est nul, la règle d'EV retient les picks les
 * plus surestimés (−14,9 points de calibration), et le couple championnat ×
 * marché ne persiste pas d'une période à l'autre (corrélation −0,022).
 *
 * Ce qui persiste, et fortement (+0,696 sur 17 marchés), c'est le COÛT de
 * chaque marché. C'est la seule grandeur sur laquelle ce service classe.
 */
@Injectable()
export class CouponPriceGenerationService {
  private readonly logger = new Logger(CouponPriceGenerationService.name);

  constructor(private readonly repository: CouponRepository) {}

  async generateForDate(forDate: Date): Promise<PriceGenerationOutcome> {
    const dayStart = startOfUtcDay(forDate);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1_000);

    const [cells, rows] = await Promise.all([
      // Calibré sur l'historique ANTÉRIEUR au jour composé : une calibration
      // qui inclut la journée qu'elle sert à composer lit son propre résultat.
      this.repository.findMarketCostCalibration(dayStart),
      this.repository.findPriceCandidates({ from: dayStart, to: dayEnd }),
    ]);

    const candidates = this.priceCandidates(cells, rows);
    if (candidates.length === 0) {
      return this.abstain(forDate, 'no_priced_candidate', rows.length);
    }

    const composition = composeByPrice(candidates, {
      minOdds: UNIFIED_COUPON_BOUNDS.minCombinedOdds,
      maxOdds: UNIFIED_COUPON_BOUNDS.maxCombinedOdds,
      minLegs: UNIFIED_COUPON_BOUNDS.minLegs,
      maxLegs: UNIFIED_COUPON_CLASS.maxLegs,
      maxPerCompetition: PRICE_COMPOSER_POLICY.maxPerCompetition,
      minExpectedReturn: PRICE_COMPOSER_POLICY.minExpectedReturn,
    });

    if (composition.outcome === 'refused') {
      return this.abstain(forDate, composition.reason, candidates.length);
    }

    const legs = composition.coupon.legs.map((leg) => ({
      fixtureId: leg.fixtureId,
      market: leg.market as Market,
      pick: leg.pick,
      odds: leg.odds,
      expectedReturn: leg.expectedReturn,
    }));
    const kickoffById = new Map(
      rows.map((row) => [row.fixtureId, row.scheduledAt]),
    );
    const lastFixtureScheduledAt = legs.reduce((latest, leg) => {
      const kickoff = kickoffById.get(leg.fixtureId);
      return kickoff && kickoff > latest ? kickoff : latest;
    }, dayStart);

    const proposalId = await this.repository.upsertPriceComposerProposal({
      forDate: dayStart,
      combinedOdds: composition.coupon.combinedOdds.toNumber(),
      expectedReturn: composition.coupon.expectedReturn.toNumber(),
      lastFixtureScheduledAt,
      legs,
    });
    await this.repository.recordPriceComposerAttempt({
      forDate: dayStart,
      outcome: 'composed',
      candidateCount: candidates.length,
      proposalId,
    });
    this.logger.log(
      `Coupon prix ${dayStart.toISOString().slice(0, 10)} : ${legs.length} jambes, ` +
        `cote ${composition.coupon.combinedOdds.toFixed(2)}, ` +
        `retour attendu ${composition.coupon.expectedReturn.toFixed(4)}`,
    );
    return {
      outcome: 'composed',
      proposalId,
      candidateCount: candidates.length,
    };
  }

  /**
   * Prix chaque jambe du vivier avec le coût mesuré de sa cellule.
   *
   * Une jambe dont la cellule ET le marché sont trop peu mesurés est écartée :
   * on ne compose pas avec ce qu'on n'a pas mesuré. Le plafond à 1 est un
   * résultat, pas une prudence — aucun des 17 marchés n'est positif, donc une
   * estimation au-dessus de 1 est un accident de fenêtre, et un compositeur qui
   * maximise le retour attendu se rue exactement dessus.
   */
  private priceCandidates(
    cells: readonly MarketCostCell[],
    rows: readonly PriceCandidateRow[],
  ): PriceCandidate[] {
    const byCell = new Map<string, Aggregate>();
    const byMarket = new Map<string, Aggregate>();
    for (const cell of cells) {
      const aggregate: Aggregate = {
        legCount: cell.legCount,
        mean: cell.meanPayout,
        meanOfSquares: cell.payoutVariance + cell.meanPayout ** 2,
      };
      byCell.set(`${cell.market}|${cell.band}`, aggregate);
      byMarket.set(cell.market, merge(byMarket.get(cell.market), aggregate));
    }

    const candidates: PriceCandidate[] = [];
    for (const row of rows) {
      const market = byMarket.get(row.market);
      if (!market || market.legCount < PRICE_COMPOSER_POLICY.minMarketLegs) {
        continue;
      }
      const cell = byCell.get(`${row.market}|${row.band}`);
      // La tranche de cote raffine le marché dès qu'elle est assez mesurée ;
      // sinon le marché fait foi. Ne jamais l'inverser : prêter à une jambe à
      // cote 2,5 le coût moyen d'un marché dominé par des favoris lui donnerait
      // un prix qu'elle n'a pas.
      const source =
        cell && cell.legCount >= PRICE_COMPOSER_POLICY.minCellLegs
          ? cell
          : market;
      const expectedReturn = Math.min(
        lowerBound(source),
        PRICE_COMPOSER_POLICY.maxCreditedReturn,
      );
      if (expectedReturn <= 0) continue;
      candidates.push({
        fixtureId: row.fixtureId,
        competition: row.competition,
        market: row.market,
        pick: row.pick,
        odds: row.odds,
        expectedReturn,
      });
    }
    return candidates;
  }

  private async abstain(
    forDate: Date,
    reason: string,
    candidateCount: number,
  ): Promise<PriceGenerationOutcome> {
    await this.repository.recordPriceComposerAttempt({
      forDate,
      outcome: 'abstained',
      candidateCount,
      reason,
    });
    // L'abstention est un résultat de qualité, pas une panne : elle est
    // enregistrée pour qu'on puisse la distinguer d'un worker tombé.
    this.logger.log(
      `Coupon prix ${startOfUtcDay(forDate).toISOString().slice(0, 10)} : ` +
        `abstention (${reason}, ${candidateCount} candidats)`,
    );
    return { outcome: 'abstained', reason, candidateCount };
  }
}

function merge(held: Aggregate | undefined, next: Aggregate): Aggregate {
  if (!held) return next;
  const legCount = held.legCount + next.legCount;
  return {
    legCount,
    mean: (held.mean * held.legCount + next.mean * next.legCount) / legCount,
    meanOfSquares:
      (held.meanOfSquares * held.legCount +
        next.meanOfSquares * next.legCount) /
      legCount,
  };
}

/**
 * Borne basse à 95 % du retour moyen.
 *
 * Créditer la moyenne observée ne suffit pas : sur une tranche de cote longue,
 * une poignée de gagnants la fait passer au-dessus de 1 et le compositeur s'y
 * précipite — la même erreur que la règle d'EV, commise un cran plus haut. Une
 * cellule très dispersée, donc mal établie, est ici automatiquement déclassée.
 */
function lowerBound(aggregate: Aggregate): number {
  const variance = Math.max(aggregate.meanOfSquares - aggregate.mean ** 2, 0);
  return (
    aggregate.mean -
    (1.96 * Math.sqrt(variance)) / Math.sqrt(aggregate.legCount)
  );
}
