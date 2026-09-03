import { Injectable } from '@nestjs/common';
import type { BetStatus, FixtureStatus, Market } from '@evcore/db';
import {
  ChannelDecisionService,
  type ChannelDecisionItem,
  type ChannelSelectionItem,
} from '@modules/betting-engine/channel-decision.service';
import {
  STRATEGY_CHANNEL,
  type StrategyChannel,
} from '@modules/betting-engine/channel-strategy.types';
import { applyReliability } from '@evcore/analysis-core';
import { DRAW_STAKED_LEAGUES } from '@modules/coupon/coupon.constants';
import {
  EXCLUSION_REASON,
  INVESTMENT_CHANNELS,
  INVESTMENT_GUARDRAILS,
  INVESTMENT_LIMITS,
  OVER_UNDER_LINES,
  type ExclusionReason,
  type InvestmentView,
} from './investment.constants';
import {
  IDENTITY_CHANNEL_STATS,
  InvestmentChannelStatsRepository,
  type ChannelStats,
  type ChannelStatsMap,
} from './investment-channel-stats.repository';
import { InvestmentCoherenceRepository } from './investment-coherence.repository';

export type InvestmentPick = {
  // Underlying ChannelSelection id — lets other services (e.g. Subscriptions)
  // link a pick shown here back to the exact DB row it came from.
  channelSelectionId: string;
  fixtureId: string;
  fixtureStatus: FixtureStatus;
  fixture: string;
  // Competition display name (e.g. "Premier League"), not the internal code —
  // the code (SWE1, D2, …) means nothing to a user.
  competition: string | null;
  competitionCode: string | null;
  country: string | null;
  kickoff: string;
  scheduledAt: string;
  homeLogo: string | null;
  awayLogo: string | null;
  // Informational only (coach-continuity.constants.ts) — never feeds
  // scoring/EV. See ChannelDecisionItem for the definition.
  homeNewCoach: boolean;
  awayNewCoach: boolean;
  channel: StrategyChannel;
  market: Market;
  pick: string;
  /**
   * Probabilité calibrée par la courbe de fiabilité du canal (Platt) — c'est
   * la fréquence de réussite attendue du pick, et le SEUL critère de tri de
   * toute la page. Ni l'EV ni l'edge ne classent quoi que ce soit ici : au
   * niveau coupon, le tri par EV perd contre le tri par probabilité dans 13
   * configurations appariées sur 16, et hors échantillon −25.94% contre
   * −6.57%.
   */
  probability: number;
  /** Sortie brute du modèle, avant correction — affichée pour transparence. */
  modelProbability: number;
  odds: number;
  ev: number | null;
  qualityScore: number | null;
  // Set once the fixture is finished — lets a past date act as a review of
  // what was recommended vs what actually hit, rather than a filter.
  score: string | null;
  htScore: string | null;
  result: BetStatus | null;
  /** ROI shrinké du canal du pick, et le volume réglé qui le soutient. */
  channelRoiShrunk: number;
  channelRoiSampleSize: number;
  /** Taux de réussite réalisé du canal — la fréquence, à côté de la cote. */
  channelHitRate: number;
  /** Renseigné uniquement dans la vue « Écarté ». */
  exclusionReason: ExclusionReason | null;
};

const INVESTMENT_CHANNEL_SET = new Set<string>(INVESTMENT_CHANNELS);
const DRAW_STAKED_LEAGUE_SET = new Set<string>(DRAW_STAKED_LEAGUES);

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Tri unique de la page : fréquence de réussite attendue, décroissante. */
function compareByProbability(a: InvestmentPick, b: InvestmentPick): number {
  return b.probability - a.probability;
}

// True when a GOALS Over/Under pick contradicts the model's own Poisson
// lambda (e.g. "Under 2.5" picked while lambdaHome+lambdaAway > 2.5) —
// verified 2026-07-06: hit rate drops 7-9pp on these vs coherent picks, on
// thousands of settled samples. A genuine model self-contradiction, and the
// right KIND of signal: a property of the pick, not a sliced result history.
function isLambdaIncoherent(input: {
  channel: StrategyChannel;
  market: Market;
  pick: string;
  lambdaTotal: number | undefined;
}): boolean {
  const { channel, market, pick, lambdaTotal } = input;
  if (
    channel !== 'GOALS' ||
    market !== 'OVER_UNDER' ||
    lambdaTotal === undefined
  ) {
    return false;
  }
  const line = OVER_UNDER_LINES[pick];
  if (line === undefined) return false;
  if (pick.startsWith('UNDER')) return lambdaTotal > line;
  if (pick.startsWith('OVER')) return lambdaTotal < line;
  return false;
}

function toInvestmentPick(
  item: ChannelDecisionItem,
  primary: ChannelSelectionItem & { odds: number },
  stats: ChannelStats,
): InvestmentPick {
  const { probability: modelProbability, odds, ev } = primary;
  return {
    channelSelectionId: primary.id,
    fixtureId: item.fixtureId,
    fixtureStatus: item.fixtureStatus,
    fixture: `${item.homeTeam} vs ${item.awayTeam}`,
    competition: item.competitionName,
    competitionCode: item.competition,
    country: item.country,
    kickoff: item.kickoff,
    scheduledAt: item.scheduledAt,
    homeLogo: item.homeLogo,
    awayLogo: item.awayLogo,
    homeNewCoach: item.homeNewCoach,
    awayNewCoach: item.awayNewCoach,
    channel: item.channel,
    market: primary.market,
    pick: primary.pick,
    probability: clamp01(applyReliability(modelProbability, stats.reliability)),
    modelProbability,
    odds,
    ev,
    qualityScore: primary.qualityScore,
    score: item.score,
    htScore: item.htScore,
    result: primary.result,
    channelRoiShrunk: stats.roiShrunk,
    channelRoiSampleSize: stats.n,
    channelHitRate: stats.hitRate,
    exclusionReason: null,
  };
}

/**
 * Raison d'exclusion d'un pick, ou `null` s'il passe les garde-fous.
 *
 * L'ordre compte : on renvoie la PREMIÈRE raison rencontrée, parce que la vue
 * « Écarté » répond à « pourquoi celui-là n'est pas dans la liste ». Les
 * raisons au niveau match (AVOID, alerte de calibration) passent avant celles
 * au niveau pick.
 */
function exclusionReasonFor(input: {
  pick: InvestmentPick;
  avoided: boolean;
  calibrationAlert: boolean;
  lambdaIncoherent: boolean;
}): ExclusionReason | null {
  const { pick, avoided, calibrationAlert, lambdaIncoherent } = input;
  if (avoided) return EXCLUSION_REASON.AVOID;
  if (calibrationAlert) return EXCLUSION_REASON.CALIBRATION_ALERT;
  if (lambdaIncoherent) return EXCLUSION_REASON.LAMBDA_INCOHERENT;
  if (pick.odds < INVESTMENT_GUARDRAILS.minOdds) {
    return EXCLUSION_REASON.ODDS_TOO_SHORT;
  }
  if (pick.probability - 1 / pick.odds > INVESTMENT_GUARDRAILS.maxEdge) {
    return EXCLUSION_REASON.EDGE_TOO_HIGH;
  }
  return null;
}

/**
 * « Investir » — le point de filtre unique du système.
 *
 * Reconstruit le 2026-08-22 (docs/audit-canaux-investir-2026-08-22.md §5).
 * Avant : 18 modes, un par canal, chacun avec son tri et son plafond `topN`
 * justifié par un backtest daté différent. La mesure a démonté cette
 * structure sur trois points :
 *
 * 1. **Aucun plafond `topN` n'est significatif.** Testés en apparié (top-N
 *    contre liste entière le MÊME jour) : VALUE t=+0.80, TEAM_TOTAL +0.70,
 *    DOMINANT −0.50, SAFE −1.20, DRAW −1.74. Les deux plus proches du seuil
 *    sont négatifs, et sur cinq essais un t=0.80 est exactement ce que le
 *    hasard produit. Garder « celui qui marche » parmi cinq règles testées,
 *    c'est le winner's curse appliqué aux règles. `topN` est donc supprimé
 *    en entier, sans exception.
 * 2. **Un plafond `topN` est lui-même une couche de sélection**, et toutes
 *    celles qui ont été mesurées ce jour-là ont DÉGRADÉ le résultat :
 *    VALUE/SAFE sur les picks Phase 1 (ratio 0.915 → 0.739), CONSENSUS via
 *    son `maxProbability`, le composeur de coupon sur ses propres jambes.
 * 3. **16 canaux sur 18 sont perdants** après shrinkage, et la granularité
 *    canal × ligue est à 76% de bruit. Un onglet par canal donne à 18 vues
 *    la même autorité visuelle alors que 2 seulement sont défendables.
 *
 * D'où trois vues au lieu de dix-huit (voir INVESTMENT_VIEWS) et un tri
 * unique : la probabilité calibrée. Ce qui reste et se renforce, ce sont les
 * signaux construits sur une CARACTÉRISTIQUE du pick plutôt que sur un
 * historique de résultats découpé — AVOID, le détecteur d'incohérence lambda,
 * le plafond d'edge et le plancher de cote.
 *
 * Une date passée n'est pas filtrée : les fixtures déjà jouées restent dans
 * la liste avec leur score et le résultat réel de chaque pick, ce qui
 * transforme la page en revue « est-ce que ça serait rentré ? ».
 */
@Injectable()
export class InvestmentService {
  constructor(
    private readonly channelDecisions: ChannelDecisionService,
    private readonly statsRepository: InvestmentChannelStatsRepository,
    private readonly coherenceRepository: InvestmentCoherenceRepository,
  ) {}

  /**
   * Picks d'une vue. `channel` ne s'applique qu'à « En observation » et
   * « Écarté » — c'est une colonne filtrable, pas un onglet.
   */
  async listPicks(query: {
    date: string;
    view: InvestmentView;
    channel?: StrategyChannel;
    competitionCode?: string;
  }): Promise<InvestmentPick[]> {
    const { kept, excluded, stats } = await this.evaluate({
      date: query.date,
      competitionCode: query.competitionCode,
    });

    if (query.view === 'excluded') {
      return byKickoff(
        applyChannelFilter(excluded, query.channel)
          .sort(compareByProbability)
          .slice(0, INVESTMENT_LIMITS.reviewMaxPicks),
      );
    }

    const assumedChannels = assumedChannelsFrom(stats);
    const isAssumed = (pick: InvestmentPick): boolean =>
      assumedChannels.has(pick.channel) && passesLeagueScope(pick);

    if (query.view === 'assumed') {
      return byKickoff(
        kept
          .filter(isAssumed)
          .sort(compareByProbability)
          .slice(0, INVESTMENT_LIMITS.assumedMaxPicks),
      );
    }

    return byKickoff(
      applyChannelFilter(
        kept.filter((pick) => !isAssumed(pick)),
        query.channel,
      )
        .sort(compareByProbability)
        .slice(0, INVESTMENT_LIMITS.reviewMaxPicks),
    );
  }

  /**
   * Ce qui est mesuré sur chaque canal à cette date : sa courbe de fiabilité
   * et son ROI shrinké.
   *
   * Exposé parce que d'autres surfaces de mise doivent pouvoir dire à
   * l'utilisateur ce qu'on sait d'un canal AVANT qu'il s'y engage — les
   * abonnements en particulier, qui proposaient sept canaux à égalité
   * visuelle alors que cinq sont mesurés perdants.
   */
  async listChannelStats(date: string): Promise<ChannelStatsMap> {
    return this.statsRepository.compute(new Date(`${date}T00:00:00.000Z`));
  }

  /**
   * Tous les picks retenus d'un canal, classés par probabilité calibrée —
   * indépendamment de la vue dans laquelle ce canal tombe.
   *
   * Sert les abonnements CHANNEL_* : un abonné a souscrit à un canal nommé,
   * pas à la partition assumé/observation, qui elle se recalcule à chaque
   * mesure et peut basculer d'un jour à l'autre.
   */
  async listChannelPicks(query: {
    date: string;
    channel: StrategyChannel;
    competitionCode?: string;
  }): Promise<InvestmentPick[]> {
    const { kept } = await this.evaluate({
      date: query.date,
      competitionCode: query.competitionCode,
    });
    return kept
      .filter((pick) => pick.channel === query.channel)
      .sort(compareByProbability);
  }

  /**
   * Évalue tous les canaux d'Investir pour une date et sépare ce qui passe
   * les garde-fous de ce qu'ils retirent. Un seul passage : les deux listes
   * sont les deux faces du même filtre, et « Écarté » ne vaut que si elle est
   * calculée par exactement les mêmes règles que le reste.
   */
  private async evaluate(query: {
    date: string;
    competitionCode?: string;
  }): Promise<{
    kept: InvestmentPick[];
    excluded: InvestmentPick[];
    stats: ChannelStatsMap;
  }> {
    const groups = await this.channelDecisions.listByChannel({
      date: query.date,
      competition: query.competitionCode,
    });

    // Leak-free: measured only on results known before the start of the
    // queried date, so a past-date review reflects what the model's bias
    // actually looked like at the time, not with hindsight.
    const asOf = new Date(`${query.date}T00:00:00.000Z`);
    const stats = await this.statsRepository.compute(asOf);

    const avoidedFixtureIds = new Set(
      groups
        .find((g) => g.channel === STRATEGY_CHANNEL.AVOID)
        ?.decisions.map((d) => d.fixtureId) ?? [],
    );

    type Candidate = {
      item: ChannelDecisionItem;
      primary: ChannelSelectionItem & { odds: number };
    };
    const candidates: Candidate[] = [];
    for (const group of groups) {
      if (!INVESTMENT_CHANNEL_SET.has(group.channel)) continue;
      for (const item of group.decisions) {
        const primary = item.selections.find((s) => s.rank === 1);
        if (!primary || primary.odds === null) continue;
        candidates.push({ item, primary: { ...primary, odds: primary.odds } });
      }
    }

    const goalsModelRunIds = candidates
      .filter(
        (c) => c.item.channel === 'GOALS' && c.primary.market === 'OVER_UNDER',
      )
      .map((c) => c.item.modelRunId);
    const lambdaTotals =
      await this.coherenceRepository.findLambdaTotals(goalsModelRunIds);

    const kept: InvestmentPick[] = [];
    const excluded: InvestmentPick[] = [];
    for (const { item, primary } of candidates) {
      const pick = toInvestmentPick(
        item,
        primary,
        stats[item.channel] ?? IDENTITY_CHANNEL_STATS,
      );
      const reason = exclusionReasonFor({
        pick,
        avoided: avoidedFixtureIds.has(item.fixtureId),
        calibrationAlert: item.calibrationAlert,
        lambdaIncoherent: isLambdaIncoherent({
          channel: item.channel,
          market: primary.market,
          pick: primary.pick,
          lambdaTotal: lambdaTotals.get(item.modelRunId),
        }),
      });
      if (reason === null) kept.push(pick);
      else excluded.push({ ...pick, exclusionReason: reason });
    }

    return { kept, excluded, stats };
  }
}

/**
 * Les canaux qu'on assume : ROI shrinké strictement positif. Recalculé, jamais
 * codé en dur — au 2026-08-22 cela donne DOUBLE_CHANCE (+2.24%) et DRAW
 * (+0.74%), les deux seuls sur 18.
 */
function assumedChannelsFrom(stats: ChannelStatsMap): Set<string> {
  return new Set(
    Object.entries(stats)
      .filter(([, s]) => s.roiShrunk > 0)
      .map(([channel]) => channel),
  );
}

/**
 * DRAW n'est assumé que sur les ligues où il est mesuré (DRAW_STAKED_LEAGUES :
 * I2, POR, BL1, CSL — ses 4 meilleures cases). La même restriction que le
 * coupon applique déjà, pour que la surface de mise soit la même partout.
 * Hors de ces ligues, ses picks retombent en observation.
 */
function passesLeagueScope(pick: InvestmentPick): boolean {
  if (pick.channel !== STRATEGY_CHANNEL.DRAW) return true;
  return (
    pick.competitionCode !== null &&
    DRAW_STAKED_LEAGUE_SET.has(pick.competitionCode)
  );
}

function applyChannelFilter(
  picks: readonly InvestmentPick[],
  channel: StrategyChannel | undefined,
): InvestmentPick[] {
  return channel === undefined
    ? [...picks]
    : picks.filter((pick) => pick.channel === channel);
}

// Selection above stays ranked by calibrated probability — only the display
// order is chronological, earliest kickoff first.
function byKickoff(picks: InvestmentPick[]): InvestmentPick[] {
  return picks.sort(
    (a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt),
  );
}
