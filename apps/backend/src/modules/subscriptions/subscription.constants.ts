import type { StrategyChannel } from '@evcore/db';
import type { InvestmentMode } from '@modules/investment/investment.constants';

export type SubscriptionSourceDef = {
  id:
    | 'COUPON_BEST'
    | 'COUPON_ALL'
    | 'CHANNEL_VALUE'
    | 'CHANNEL_SAFE'
    | 'CHANNEL_DOMINANT'
    | 'CHANNEL_DRAW'
    | 'CHANNEL_BTTS'
    | 'CHANNEL_TEAM_TOTAL';
  label: string;
  kind: 'COUPON' | 'CHANNEL';
  channel?: StrategyChannel;
  // Mode Investir réutilisé quand channelPickMode === 'INVESTIR'.
  investmentMode?: InvestmentMode;
};

// Catalogue fermé — voir DESIGN.md §Décisions de conception, point 1. GOALS
// exclu volontairement : mesuré négatif (-5.39% ROI, 15 685 sélections,
// db:backtest:team-total-btts-competition 2026-07-28), l'offrir comme cible
// d'abonnement contredirait la discipline documentée dans goals-channel.md.
export const SUBSCRIPTION_SOURCES: readonly SubscriptionSourceDef[] = [
  { id: 'COUPON_BEST', label: 'Coupon (meilleur du jour)', kind: 'COUPON' },
  { id: 'COUPON_ALL', label: 'Coupon (chaque coupon généré)', kind: 'COUPON' },
  {
    id: 'CHANNEL_VALUE',
    label: 'VALUE (Valeur)',
    kind: 'CHANNEL',
    channel: 'VALUE',
    investmentMode: 'value',
  },
  {
    id: 'CHANNEL_SAFE',
    label: 'SAFE (Sécurité)',
    kind: 'CHANNEL',
    channel: 'SAFE',
    investmentMode: 'safe',
  },
  {
    id: 'CHANNEL_DOMINANT',
    label: 'DOMINANT (Victoire)',
    kind: 'CHANNEL',
    channel: 'DOMINANT',
    investmentMode: 'dominant',
  },
  {
    id: 'CHANNEL_DRAW',
    label: 'DRAW (Nul)',
    kind: 'CHANNEL',
    channel: 'DRAW',
    investmentMode: 'draw',
  },
  {
    id: 'CHANNEL_BTTS',
    label: 'BTTS (BB)',
    kind: 'CHANNEL',
    channel: 'BTTS',
    investmentMode: 'btts',
  },
  {
    id: 'CHANNEL_TEAM_TOTAL',
    label: 'TEAM_TOTAL',
    kind: 'CHANNEL',
    channel: 'TEAM_TOTAL',
    investmentMode: 'teamTotal',
  },
] as const;

export type SubscriptionChannelPickModeDef = {
  id: 'INVESTIR' | 'DECISIONS_FIRST' | 'DECISIONS_LAST';
  label: string;
};

// Uniquement proposé/pertinent quand la source choisie est un CHANNEL_*.
// Les deux variantes DECISIONS_* restent sans classement proba/edge — voir
// le commentaire sur SubscriptionChannelPickMode (schema.prisma) pour le
// backtest qui justifie de laisser le choix à l'utilisateur plutôt que de
// trancher unilatéralement.
export const SUBSCRIPTION_CHANNEL_PICK_MODES: readonly SubscriptionChannelPickModeDef[] =
  [
    { id: 'INVESTIR', label: 'Picks Investir (classés et calibrés)' },
    {
      id: 'DECISIONS_FIRST',
      label: 'Premiers matchs du jour (Decisions, non classé)',
    },
    {
      id: 'DECISIONS_LAST',
      label: 'Derniers matchs du jour (Decisions, non classé)',
    },
  ] as const;

// Catalogue fermé, pas un entier libre — 1 seul événement/jour n'a pas de
// sens statistique pour juger une discipline ; 3 et 5 sont repris tels quels
// des valeurs déjà backtestées dans MODE_RANKING (TOP_NS = [3, 5]).
export const SUBSCRIPTION_TOPN_OPTIONS = [1, 3, 5] as const;

export type SubscriptionLeaguePresetDef = {
  id: string;
  label: string;
  competitionCodes: readonly string[];
};

// Raccourci de saisie UI uniquement — pré-coche ces codes dans le multi-select
// de compétitions, ne restreint rien côté serveur (voir DESIGN.md §6).
export const SUBSCRIPTION_LEAGUE_PRESETS: readonly SubscriptionLeaguePresetDef[] =
  [
    {
      id: 'TOP5_EUROPE',
      label: 'Grands championnats européens',
      competitionCodes: ['PL', 'BL1', 'SA', 'LL', 'L1'],
    },
    {
      id: 'UEFA_CUPS',
      label: 'Coupes européennes (UEFA)',
      competitionCodes: ['UCL', 'UEL', 'UECL'],
    },
  ] as const;

export const SUBSCRIPTION_WEEKDAYS = [
  { value: 0, label: 'Dimanche' },
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
] as const;

export function findSubscriptionSource(
  id: string,
): SubscriptionSourceDef | undefined {
  return SUBSCRIPTION_SOURCES.find((s) => s.id === id);
}
