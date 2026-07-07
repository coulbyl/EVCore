import { Injectable } from '@nestjs/common';
import type { BetStatus, Market } from '@evcore/db';
import {
  ChannelDecisionService,
  type ChannelDecisionItem,
  type ChannelSelectionItem,
} from '@modules/betting-engine/channel-decision.service';
import {
  STRATEGY_CHANNEL,
  type StrategyChannel,
} from '@modules/betting-engine/channel-strategy.types';
import { ANALYSIS_SHEET_CHANNELS } from '@modules/analysis-sheet/analysis-sheet.constants';
import { EV_THRESHOLD } from '@modules/betting-engine/ev.constants';
import {
  INVESTMENT_CALIBRATION,
  INVESTMENT_LIMITS,
  MODE_RANKING,
  NEGATIVE_ROI_CHANNELS,
  ODDS_SHORT_THRESHOLD,
  OVER_UNDER_LINES,
  PROBABILITY_BUCKETS,
  SINGLE_CHANNEL_MODE_MAP,
  VALUE_MODE_CHANNELS,
  type InvestmentMode,
  type ProbabilityBucket,
  type SingleChannelMode,
} from './investment.constants';
import {
  InvestmentCalibrationRepository,
  type ChannelCalibration,
} from './investment-calibration.repository';
import { InvestmentCoherenceRepository } from './investment-coherence.repository';

export type InvestmentPick = {
  fixtureId: string;
  fixture: string;
  // Competition display name (e.g. "Premier League"), not the internal code —
  // the code (SWE1, D2, …) means nothing to a user.
  competition: string | null;
  country: string | null;
  kickoff: string;
  scheduledAt: string;
  homeLogo: string | null;
  awayLogo: string | null;
  channel: StrategyChannel;
  market: Market;
  pick: string;
  comboMarket: Market | null;
  comboPick: string | null;
  // Calibrated (bias-corrected) probability — see class doc. This is what
  // drives probabilityBucket and the ranking, not the raw model output.
  probability: number;
  // Raw model probability, before the per-channel calibration correction —
  // kept for transparency (e.g. "modèle : X%" alongside the calibrated %).
  modelProbability: number;
  probabilityBucket: ProbabilityBucket;
  odds: number;
  ev: number | null;
  qualityScore: number | null;
  // Set once the fixture is finished — lets a past date act as a review of
  // what was recommended vs what actually hit, rather than a filter.
  score: string | null;
  htScore: string | null;
  result: BetStatus | null;
  // Informational only — none of these ever exclude a pick from the list
  // (see class doc). The page ranks by "chance de gagner" (probability), not
  // by expected value: a high-probability, EV-negative pick is a legitimate
  // individual choice, not noise to filter out.
  evSign: 'positive' | 'negative' | null;
  shortOdds: boolean;
  channelRoiFlag: boolean;
};

const PROBABILITY_MODE_CHANNELS = new Set<string>(ANALYSIS_SHEET_CHANNELS);
const VALUE_MODE_CHANNEL_SET = new Set<string>(VALUE_MODE_CHANNELS);
const NEGATIVE_ROI_CHANNEL_SET = new Set<string>(NEGATIVE_ROI_CHANNELS);

function isSingleChannelMode(mode: InvestmentMode): mode is SingleChannelMode {
  return mode in SINGLE_CHANNEL_MODE_MAP;
}

function channelsForMode(mode: InvestmentMode): Set<string> {
  if (mode === 'value') return VALUE_MODE_CHANNEL_SET;
  if (isSingleChannelMode(mode)) {
    return new Set([SINGLE_CHANNEL_MODE_MAP[mode]]);
  }
  return PROBABILITY_MODE_CHANNELS;
}

const BUCKET_ORDER: Record<ProbabilityBucket, number> = {
  veryLikely: 0,
  solid: 1,
  moderate: 2,
  speculative: 3,
};

function bucketFor(probability: number): ProbabilityBucket {
  if (probability >= PROBABILITY_BUCKETS.veryLikely) return 'veryLikely';
  if (probability >= PROBABILITY_BUCKETS.solid) return 'solid';
  if (probability >= PROBABILITY_BUCKETS.moderate) return 'moderate';
  return 'speculative';
}

// "probability" mode: highest chance of winning first (see class doc).
function compareByProbability(a: InvestmentPick, b: InvestmentPick): number {
  const bucketDiff =
    BUCKET_ORDER[a.probabilityBucket] - BUCKET_ORDER[b.probabilityBucket];
  if (bucketDiff !== 0) return bucketDiff;
  return b.probability - a.probability;
}

// "edge" ranking: calibrated edge (probability - 1/odds), highest first. The
// stored EV is computed from the RAW model probability, so ranking by it
// ranks by model overconfidence; `probability` here is already the
// bias-corrected one (see class doc), which is what made this ranking the
// only one still positive on 2026 forward data for VALUE and monotonically
// improving on DRAW (db:backtest:invest-ranking, 2026-07-07).
function compareByEdge(a: InvestmentPick, b: InvestmentPick): number {
  return b.probability - 1 / b.odds - (a.probability - 1 / a.odds);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// True when a GOALS Over/Under pick contradicts the model's own Poisson
// lambda (e.g. "Under 2.5" picked while lambdaHome+lambdaAway > 2.5) —
// verified 2026-07-06: hit rate drops 7-9pp on these vs coherent picks, on
// thousands of settled samples. A genuine model self-contradiction, not a
// soft quality signal, so it's excluded rather than badged (unlike EV/odds).
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
  calibration: ChannelCalibration,
): InvestmentPick {
  const { probability: modelProbability, odds, ev } = primary;
  const meanError = calibration[item.channel] ?? 0;
  const probability = clamp01(modelProbability - meanError);
  return {
    fixtureId: item.fixtureId,
    fixture: `${item.homeTeam} vs ${item.awayTeam}`,
    competition: item.competitionName,
    country: item.country,
    kickoff: item.kickoff,
    scheduledAt: item.scheduledAt,
    homeLogo: item.homeLogo,
    awayLogo: item.awayLogo,
    channel: item.channel,
    market: primary.market,
    pick: primary.pick,
    comboMarket: primary.comboMarket,
    comboPick: primary.comboPick,
    probability,
    modelProbability,
    probabilityBucket: bucketFor(probability),
    odds,
    ev,
    qualityScore: primary.qualityScore,
    score: item.score,
    htScore: item.htScore,
    result: primary.result,
    evSign: ev === null ? null : ev >= 0 ? 'positive' : 'negative',
    shortOdds: odds < ODDS_SHORT_THRESHOLD,
    channelRoiFlag: NEGATIVE_ROI_CHANNEL_SET.has(item.channel),
  };
}

/**
 * "Investir" — meilleurs picks individuels du jour. Modes :
 *
 * - "probability" (défaut) : tous les canaux confondus, classés par
 *   probabilité de réussite (pas par EV). Un pick à haute probabilité et EV
 *   légèrement négative reste une position individuelle légitime (ex. un
 *   favori à cote courte) — voir le contexte du plan pour le raisonnement
 *   complet. EV/qualityScore/canal ne pilotent que des badges informatifs,
 *   jamais une exclusion.
 * - "value" : VALUE uniquement, EV >= EV_THRESHOLD, classés par edge calibré
 *   (probabilité corrigée - 1/cote) décroissant. Ajouté après avoir constaté
 *   (2026-07-06, ex. journée du 17/05) que le mode probabilité enterre les
 *   vrais picks à forte value derrière des favoris à cote courte ; le tri par
 *   EV brute a ensuite été remplacé par l'edge calibré (2026-07-07, voir
 *   MODE_RANKING) : l'EV stockée est calculée sur la proba brute sur-confiante,
 *   donc trier dessus revient à trier par sur-confiance du modèle.
 * - "safe" / "dominant" / "btts" / "goals" / "draw" (SINGLE_CHANNEL_MODE_MAP) :
 *   un onglet par canal restant, chacun restreint à son canal, avec tri et
 *   cap topN par canal (MODE_RANKING) : DRAW par edge calibré top5,
 *   SAFE/DOMINANT par probabilité top5, BTTS/GOALS par probabilité sans cap
 *   (aucun classement n'y est rentable — voir investment.constants.ts pour
 *   les chiffres du backtest). SAFE a d'abord été inclus dans "value", mais
 *   un backtest jour par jour complet (pnpm --filter @evcore/db
 *   db:backtest:ev-tiers, 2026-07-06) a montré que son tier EV>=0.08 est PIRE
 *   que son tier EV<0.08 (ROI -3.42% vs son propre tier bas, et -8.38% dans
 *   son propre bucket "très probable") — l'edge de SAFE est la probabilité,
 *   pas l'EV. VALUE reste le seul canal où l'EV>=0.08 est majoritairement
 *   gagnant (52.6% des jours, +10.73% ROI) sur l'historique complet ;
 *   DOMINANT/BTTS montrent une discrimination inversée, GOALS aucune — ces 3
 *   canaux ont un ROI agrégé négatif en solo (channelRoiFlag), affiché sur
 *   chaque pick, mais restent consultables individuellement plutôt que
 *   masqués.
 *
 * Une date passée n'est PAS filtrée : les fixtures déjà jouées restent dans
 * la liste avec leur score et le résultat réel de chaque pick (`result`), ce
 * qui transforme la page en revue "est-ce que ça serait rentré ?" quand on
 * navigue dans le passé — le même classement s'applique.
 *
 * Réutilise ChannelDecisionService.listByChannel (déjà exporté par
 * BettingEngineModule) plutôt que de dupliquer une requête Prisma — cette
 * lecture normalisée par canal existe déjà et calcule déjà `calibrationAlert`.
 *
 * La probabilité affichée est corrigée par canal (InvestmentCalibrationRepository)
 * avant de déterminer le bucket : vérifié sur 3 ans de données (2026-07-06) que
 * le modèle est sur-confiant de façon très inégale selon le canal (SAFE +12.5pp,
 * VALUE +9.8pp, GOALS +6.9pp, DOMINANT +3.0pp, BTTS +1.0pp, DRAW -1.8pp) — sans
 * cette correction, "Très probable" annonçait ~87% de confiance modèle pour un
 * taux de réussite réel de 64%.
 *
 * Les picks GOALS Over/Under dont la direction contredit le lambda du modèle
 * (InvestmentCoherenceRepository) sont exclus — pas juste badgés — car c'est
 * une auto-contradiction du modèle, pas un simple signal de qualité (voir
 * isLambdaIncoherent).
 */
@Injectable()
export class InvestmentService {
  constructor(
    private readonly channelDecisions: ChannelDecisionService,
    private readonly calibrationRepository: InvestmentCalibrationRepository,
    private readonly coherenceRepository: InvestmentCoherenceRepository,
  ) {}

  async listBestPicks(query: {
    date: string;
    competitionCode?: string;
    mode?: InvestmentMode;
    // Explicit display filter from the client — overrides the mode's default
    // topN (MODE_RANKING) in either direction, but never exceeds maxPicks
    // (the DTO enforces the same bound at the HTTP boundary).
    topN?: number;
  }): Promise<InvestmentPick[]> {
    const mode = query.mode ?? 'probability';
    const eligibleChannels = channelsForMode(mode);

    const groups = await this.channelDecisions.listByChannel({
      date: query.date,
      competition: query.competitionCode,
    });

    // Leak-free: calibration is measured only on results known before the
    // start of the queried date, so a past-date review reflects what the
    // model's bias actually looked like at the time, not with hindsight.
    const asOf = new Date(`${query.date}T00:00:00.000Z`);
    const calibration = await this.calibrationRepository.computeMeanError(
      [...eligibleChannels] as StrategyChannel[],
      INVESTMENT_CALIBRATION.windowDays,
      asOf,
    );

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
      if (!eligibleChannels.has(group.channel)) continue;

      for (const item of group.decisions) {
        // Model↔market coherence gate tripped — data unreliable for this fixture.
        if (item.calibrationAlert) continue;
        // AVOID SELECTED on this fixture — implausible model↔market divergence.
        if (avoidedFixtureIds.has(item.fixtureId)) continue;

        const primary = item.selections.find((s) => s.rank === 1);
        if (!primary || primary.odds === null) continue;
        // Value mode: EV only predicts a better outcome within VALUE
        // (see class doc) — enforce the same floor used everywhere else.
        if (
          mode === 'value' &&
          (primary.ev === null || primary.ev < EV_THRESHOLD.toNumber())
        ) {
          continue;
        }

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

    const picks: InvestmentPick[] = [];
    for (const { item, primary } of candidates) {
      if (
        isLambdaIncoherent({
          channel: item.channel,
          market: primary.market,
          pick: primary.pick,
          lambdaTotal: lambdaTotals.get(item.modelRunId),
        })
      ) {
        continue;
      }
      picks.push(toInvestmentPick(item, primary, calibration));
    }

    const ranking = MODE_RANKING[mode];
    picks.sort(ranking.sort === 'edge' ? compareByEdge : compareByProbability);
    const topN = query.topN ?? ranking.topN ?? Infinity;
    return picks.slice(0, Math.min(topN, INVESTMENT_LIMITS.maxPicks));
  }
}
