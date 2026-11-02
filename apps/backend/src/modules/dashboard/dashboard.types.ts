import type { StrategyChannel } from '@evcore/db';

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

/**
 * One (channel × competition) row of settled selections. Most cells are
 * thin (many channels × competitions): `status` honestly reports
 * INSUFFICIENT_DATA rather than hiding the row.
 */
export type ChannelCompetitionStatItem = {
  channel: TrackedChannel;
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
  /** Hit rate ÷ average announced probability; drives `status`. */
  calibrationRatio: number | null;
  sampleSize: number;
  status: ChannelStatus;
};
