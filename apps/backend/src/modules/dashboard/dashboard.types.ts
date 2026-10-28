import type { StrategyChannel } from '@evcore/db';

export type KpiDelta = string | { bet: number; noBet: number };

export type KpiCard = {
  label: string;
  value: string;
  delta: KpiDelta;
  tone: 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
};

export type WorkerStatus = {
  worker: string;
  lastRun: string;
  status: 'healthy' | 'watch' | 'late';
  detail: string;
};

export type AlertItem = {
  id: string;
  title: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
};

export type PnlSummary = {
  settledBets: number;
  wonBets: number;
  winRate: string;
  netUnits: string;
  roi: string;
};

export type DashboardSummary = {
  dashboardKpis: KpiCard[];
  workerStatuses: WorkerStatus[];
  activeAlerts: AlertItem[];
  pnlSummary: PnlSummary;
};

export type CompetitionModelStats = {
  settled: number;
  won: number;
  /** null si settled < 10 (données insuffisantes) */
  winRate: string | null;
  /** Réel/annoncé — même formule que ChannelHealthItem.calibrationRatio,
   * pilote `status`. Remplace le ROI comme critère de classement/affichage :
   * voir CLAUDE.md, le ROI est anti-prédictif/bruité à ce volume. null si
   * settled < 10. */
  calibrationRatio: number | null;
  status: ChannelStatus;
};

export type CompetitionStat = {
  competitionId: string;
  competitionName: string;
  competitionCode: string;
  activeFixtures: number;
  model: CompetitionModelStats;
};

/**
 * En-tête de la page Mesures historiques : ce que les canaux ont annoncé et
 * ce qui est arrivé, sur les sélections d'avant-match dédupliquées de la
 * période (même source que le tableau par canal). Remplace le résumé lu dans
 * la table `bet`, plus alimentée depuis le 2026-09-04, qui affichait
 * « 1 pari réglé, 100 %, +64 % » sur 30 jours (audit du 2026-10-23, P1-5).
 */
export type TrackRecordRates = {
  /** Sélections réglées (gagnées ou perdues). */
  settled: number;
  won: number;
  /** Probabilité moyenne annoncée par le moteur, 0–1 ; vue admin. */
  announced: number | null;
  /**
   * Fréquence du marché moyenne, 0–1 : 1 / cote, marge retirée (la marge
   * payée, sinon la typique du marché). C'est la référence montrée au joueur
   * depuis le 2026-10-28, à lire face à `realised`, sans verdict.
   */
  market: number | null;
  /** Taux de réussite réel, 0–1 ; null sans sélection. */
  realised: number | null;
  /** Retour d'une mise de 1 à la cote d'analyse (0,97 = −3 %). */
  returnPerUnit: number | null;
  /** Assez de sélections pour lire les taux (seuil de la page). */
  sufficient: boolean;
};

/** Même cohorte que l'en-tête, restreinte à une tranche de cote. */
export type TrackRecordOddsBand = TrackRecordRates & {
  /** Borne basse incluse ; null = pas de borne. */
  minOdds: number | null;
  /** Borne haute exclue ; null = pas de borne. */
  maxOdds: number | null;
  /** Même règle que les canaux (écart réalisé/annoncé, seuil de 30). */
  status: ChannelStatus;
};

export type TrackRecordSummary = TrackRecordRates & {
  from: string;
  to: string;
  /** Tranches de TRACK_RECORD_ODDS_BREAKS, dans l'ordre des cotes. */
  byOdds: TrackRecordOddsBand[];
};

export type LeaderboardEntry = {
  rank: number;
  username: string;
  /** ROI formaté ex. "+12.3%" */
  roi: string;
  settled: number;
  won: number;
};

export type ChannelStatus =
  | 'GREEN'
  | 'ORANGE'
  | 'RED'
  | 'INACTIVE'
  | 'INSUFFICIENT_DATA';

/**
 * Canal suivi. Le type reprend l'enum Prisma au lieu d'énumérer les canaux à
 * la main : une union écrite en dur ne se met pas à jour toute seule, et c'est
 * exactement ce qui avait laissé 8 canaux hors du suivi (voir
 * TRACKED_CHANNELS, dashboard.constants.ts).
 */
export type TrackedChannel = StrategyChannel;

export type ChannelHealthItem = {
  channel: TrackedChannel;
  status: ChannelStatus;
  primaryMetric: number;
  primaryMetricType: 'ROI' | 'HIT_RATE';
  roi: number | null;
  hitRate: number | null;
  /** Réel/annoncé (hitRate ÷ probabilité moyenne annoncée) — drives `status`,
   * never `roi` (see CLAUDE.md: ROI is anti-predictive/noisy at this
   * volume; calibration is the standard admission signal everywhere else
   * in the product). */
  calibrationRatio: number | null;
  vsThreshold: number | null;
  sampleSize: number;
};

export type ChannelStatsItem = {
  channel: TrackedChannel;
  hitRate: number | null;
  avgThreshold: number | null;
  vsThreshold: number | null;
  roi: number | null;
  netUnits: number | null;
  maxDrawdown: number | null;
  sampleSize: number;
  oddsAvailabilityRate: number;
  trend: 'UP' | 'FLAT' | 'DOWN';
  /** Probabilité moyenne annoncée par le moteur, 0–1 ; vue admin. */
  announced: number | null;
  /**
   * Fréquence du marché moyenne, 0–1 : 1 / cote, marge retirée (la marge
   * payée, sinon la typique du marché). C'est la référence montrée au joueur
   * depuis le 2026-10-28, à lire face à `realised`, sans verdict.
   */
  market: number | null;
};

/**
 * One (channel × competition) row — same settled-selection source as
 * `ChannelStatsItem`, grouped one level finer. Independent tracking section
 * on the track-record page: most cells will be thin (many channels ×
 * competitions), `status` honestly reports INSUFFICIENT_DATA rather than
 * hiding the row — consistent with "un canal négatif reste affiché comme
 * tel".
 */
export type ChannelCompetitionStatItem = {
  channel: ChannelStatsItem['channel'];
  competitionCode: string;
  competitionName: string;
  competitionCountry: string;
  roi: number | null;
  hitRate: number | null;
  /** Probabilité moyenne annoncée par le moteur, 0–1 ; vue admin. */
  announced: number | null;
  /**
   * Fréquence du marché moyenne, 0–1 : 1 / cote, marge retirée (la marge
   * payée, sinon la typique du marché). C'est la référence montrée au joueur
   * depuis le 2026-10-28, à lire face à `realised`, sans verdict.
   */
  market: number | null;
  /** See ChannelHealthItem.calibrationRatio — same formula, drives `status`. */
  calibrationRatio: number | null;
  sampleSize: number;
  status: ChannelStatus;
};
