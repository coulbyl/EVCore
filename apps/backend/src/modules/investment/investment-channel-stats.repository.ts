import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import {
  fitReliability,
  shrinkTowardPooled,
  IDENTITY_RELIABILITY,
  type ChannelReliability,
  type ReliabilityObservation,
} from '@evcore/analysis-core';
import {
  INVESTMENT_CHANNELS,
  INVESTMENT_STATS_WINDOW_DAYS,
} from './investment.constants';

/** Ce qu'Investir sait d'un canal, mesuré, à la date consultée. */
export type ChannelStats = {
  /** Courbe de Platt du canal, shrinkée vers le poolé (channel-reliability.ts). */
  reliability: ChannelReliability;
  /** ROI moyen brut par sélection réglée, mise plate. */
  roiRaw: number;
  /** ROI ramené vers la moyenne globale par Bayes empirique — voir la classe. */
  roiShrunk: number;
  /** Poids du canal dans son propre signal : t²/(t²+SE²), dans [0, 1]. */
  roiWeight: number;
  /** Taux de réussite réalisé. */
  hitRate: number;
  /** Sélections réglées sur lesquelles tout ce qui précède est mesuré. */
  n: number;
};

export type ChannelStatsMap = Record<string, ChannelStats>;

type StatsRow = {
  channel: string;
  probability: number;
  odds: number;
  won: boolean;
};

// Les statistiques ne dépendent que de la date consultée (coupure
// point-in-time), donc elles sont mémoïsables telles quelles. Sans ça, chaque
// chargement de page refait un scan de dizaines de milliers de sélections
// réglées pour un résultat identique.
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX_ENTRIES = 8;

/**
 * Ce qu'on sait de chaque canal, mesuré à la date consultée : sa courbe de
 * fiabilité et son ROI shrinké.
 *
 * **Fiabilité** — Platt sur l'échelle logit (voir channel-reliability.ts).
 * Remplace l'ancien `computeMeanError` (décalage constant) : mesuré le
 * 2026-08-22, la courbe est plus PLATE que la diagonale, pas simplement
 * décalée — l'annoncé va de 0.46 à 0.81 pendant que le réalisé ne va que de
 * 0.46 à 0.59. Soustraire une constante laisse le bas sous-corrigé et le haut
 * toujours sur-confiant. Le passage à Platt a fait passer le ratio
 * réalisé/annoncé de 0.819 à 1.016.
 *
 * **ROI shrinké** — Bayes empirique. Le ROI brut d'un canal mélange son vrai
 * niveau et le bruit d'échantillonnage ; à granularité fine, l'audit mesure
 * que seuls 24% de l'écart observé entre cases sont réels. Chaque canal est
 * donc ramené vers la moyenne globale du poids `t²/(t²+SE²)`, où `t²` est la
 * variance RÉELLE entre canaux (variance observée moins variance
 * d'échantillonnage). C'est ce qui empêche un canal à n=121 et +27.95% brut de
 * passer pour un résultat.
 *
 * Coupure point-in-time (`asOf`) sur les mêmes rails que le reste du système :
 * seules les rencontres jouées avant la date consultée comptent, pour qu'une
 * revue d'une date passée reflète ce qu'on savait à ce moment-là et pas avec
 * le recul.
 */
@Injectable()
export class InvestmentChannelStatsRepository {
  private readonly cache = new Map<
    string,
    { at: number; stats: ChannelStatsMap }
  >();

  constructor(private readonly prisma: PrismaService) {}

  async compute(asOf: Date): Promise<ChannelStatsMap> {
    const key = asOf.toISOString();
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.stats;

    const rows = await this.fetchSettled(asOf);
    const stats = buildStats(rows);

    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = [...this.cache.entries()].sort(
        (a, b) => a[1].at - b[1].at,
      )[0];
      if (oldest) this.cache.delete(oldest[0]);
    }
    this.cache.set(key, { at: Date.now(), stats });
    return stats;
  }

  private fetchSettled(asOf: Date): Promise<StatsRow[]> {
    // Fenêtre ouverte quand INVESTMENT_STATS_WINDOW_DAYS vaut null : une borne
    // basse antérieure à toute donnée revient à ne pas borner, et garde la
    // requête à une seule forme (pas de fragment SQL conditionnel).
    const since =
      INVESTMENT_STATS_WINDOW_DAYS === null
        ? new Date(0)
        : new Date(
            asOf.getTime() - INVESTMENT_STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000,
          );
    const channels = [...INVESTMENT_CHANNELS];

    // DISTINCT ON garde le dernier ModelRun par (match, canal) : un match
    // réanalysé ne doit pas peser plusieurs fois dans la mesure.
    return this.prisma.client.$queryRaw<StatsRow[]>`
      SELECT DISTINCT ON (mr."fixtureId", cd.channel)
        cd.channel::text AS channel,
        cs.probability::float8 AS probability,
        cs.odds::float8 AS odds,
        (cs.result = 'WON') AS won
      FROM channel_decision cd
      JOIN model_run mr ON mr.id = cd."modelRunId"
      JOIN fixture f ON f.id = mr."fixtureId"
      JOIN channel_selection cs
        ON cs."channelDecisionId" = cd.id AND cs.rank = 1
      WHERE cd.status = 'SELECTED'
        AND cd.channel = ANY(${channels}::"StrategyChannel"[])
        AND cs.odds IS NOT NULL
        AND cs.result IN ('WON', 'LOST')
        AND f."scheduledAt" >= ${since}
        AND f."scheduledAt" < ${asOf}
      ORDER BY mr."fixtureId", cd.channel, mr."analyzedAt" DESC
    `;
  }
}

type ChannelAccumulator = {
  observations: ReliabilityObservation[];
  rois: number[];
};

/** ROI d'une sélection, mise plate : `cote − 1` si gagnée, `−1` sinon. */
function roiOf(row: StatsRow): number {
  return row.won ? row.odds - 1 : -1;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function sampleVariance(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
}

/**
 * Erreur-type de la moyenne, plancher inclus.
 *
 * Le plancher n'est pas une précaution numérique, il corrige un biais réel :
 * un petit canal dont toutes les sélections ont le même résultat affiche une
 * variance d'échantillon nulle, donc une SE nulle, donc un poids de 1 — le
 * shrinkage lui accorderait une confiance TOTALE précisément là où il y a le
 * moins de données. Une variance nulle sur 4 lignes n'est pas de la précision,
 * c'est un artefact. On plancher donc la SE à celle qu'aurait ce canal s'il
 * avait la dispersion du pool.
 */
function standardError(values: readonly number[], pooledVariance: number) {
  if (values.length < 2) return Infinity;
  const own = Math.sqrt(sampleVariance(values) / values.length);
  return Math.max(own, Math.sqrt(pooledVariance / values.length));
}

/**
 * Variance RÉELLE entre canaux : variance observée des moyennes moins la
 * variance d'échantillonnage moyenne. Négative signifie que tout l'écart
 * observé s'explique par le bruit — on la ramène alors à zéro, ce qui shrinke
 * tous les canaux jusqu'à la moyenne globale.
 */
function trueVariance(channelMeans: readonly number[], meanSeSquared: number) {
  if (channelMeans.length < 2) return 0;
  const grand = mean(channelMeans);
  const observed =
    channelMeans.reduce((sum, m) => sum + (m - grand) ** 2, 0) /
    (channelMeans.length - 1);
  return Math.max(0, observed - meanSeSquared);
}

export function buildStats(rows: readonly StatsRow[]): ChannelStatsMap {
  const byChannel = new Map<string, ChannelAccumulator>();
  const all: ReliabilityObservation[] = [];
  const allRois: number[] = [];

  for (const row of rows) {
    const observation: ReliabilityObservation = {
      probability: row.probability,
      won: row.won,
    };
    const roi = roiOf(row);
    all.push(observation);
    allRois.push(roi);

    const bucket = byChannel.get(row.channel) ?? { observations: [], rois: [] };
    bucket.observations.push(observation);
    bucket.rois.push(roi);
    byChannel.set(row.channel, bucket);
  }

  if (byChannel.size === 0) return {};

  const pooledReliability = fitReliability(all);
  const grandRoi = mean(allRois);
  const pooledVariance = sampleVariance(allRois);

  const entries = [...byChannel.entries()].map(([channel, acc]) => ({
    channel,
    acc,
    roiRaw: mean(acc.rois),
    se: standardError(acc.rois, pooledVariance),
  }));

  const finite = entries.filter((e) => Number.isFinite(e.se));
  const meanSeSquared = mean(finite.map((e) => e.se ** 2));
  const tau2 = trueVariance(
    finite.map((e) => e.roiRaw),
    meanSeSquared,
  );

  const stats: ChannelStatsMap = {};
  for (const { channel, acc, roiRaw, se } of entries) {
    const weight =
      Number.isFinite(se) && tau2 > 0 ? tau2 / (tau2 + se ** 2) : 0;
    stats[channel] = {
      reliability: shrinkTowardPooled(
        fitReliability(acc.observations),
        pooledReliability,
      ),
      roiRaw,
      roiShrunk: grandRoi + weight * (roiRaw - grandRoi),
      roiWeight: weight,
      hitRate: mean(acc.observations.map((o) => (o.won ? 1 : 0))),
      n: acc.rois.length,
    };
  }
  return stats;
}

export const IDENTITY_CHANNEL_STATS: ChannelStats = {
  reliability: IDENTITY_RELIABILITY,
  roiRaw: 0,
  roiShrunk: 0,
  roiWeight: 0,
  hitRate: 0,
  n: 0,
};
