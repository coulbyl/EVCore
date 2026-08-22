import type { StrategyChannel } from '@evcore/db';
import type { InvestmentMode } from '@modules/investment/investment.constants';

// Payload du job BullMQ SUBSCRIPTION_MATCHING — vide, le job réévalue tous
// les abonnements actifs à chaque passage (voir SubscriptionMatchingService).
// Source unique de vérité : le worker (etl/workers/subscription-matching.worker.ts)
// et SubscriptionsService (déclenchement à la création) importent ce type
// plutôt que d'en dupliquer chacun une définition.
export type SubscriptionMatchingJobData = Record<string, never>;

// Déclenchement à la création d'un abonnement (voir SubscriptionsService.create) :
// au lieu d'attendre jusqu'à 1h le prochain tick cron, on planifie un run
// différé de courte durée. Le délai laisse le temps à d'éventuelles créations
// quasi simultanées (plusieurs abonnements créés à la suite) de se regrouper
// dans un seul run via `deduplication` (BullMQ) plutôt que d'empiler un job
// par création.
export const SUBSCRIPTION_MATCHING_TRIGGER_DELAY_MS = 5_000;
export const SUBSCRIPTION_MATCHING_TRIGGER_DEDUP_ID =
  'subscription-matching-on-create';

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
  // topN autorisés pour ce canal — undefined sur une source COUPON.
  topNOptions?: readonly number[];
};

// Catalogue fermé, pas un entier libre — 1 seul événement/jour n'a pas de
// sens statistique pour juger une discipline ; 3 et 5 sont repris tels quels
// des valeurs déjà backtestées dans MODE_RANKING (TOP_NS = [3, 5]).
const DEFAULT_CHANNEL_TOPN_OPTIONS = [1, 3, 5] as const;

// VALUE : top3 retiré — db:backtest:invest-ranking (2026-08-01, tout
// l'historique + 2026 isole) montre edgeCal top3 nettement sous top5
// (ROI 10.4% vs 14.5% tout l'historique, -7.8% vs +6.7% sur 2026 seul,
// valid split 3.6% vs 9.7%). Ni un plafonnement ni une penalite de l'edge
// au-dela du pic observe (0.15-0.2) ne rattrape l'ecart en topN=3 — la
// largeur (5) compte plus que la forme du score a ce N. TEAM_TOTAL a ete
// teste dans l'autre sens (son topN=3 actuel bat 5/7/10, ne pas y toucher).
const VALUE_TOPN_OPTIONS = [1, 5] as const;

// Catalogue fermé — voir DESIGN.md §Décisions de conception, point 1. GOALS
// exclu volontairement : mesuré négatif (-5.39% ROI, 15 685 sélections,
// db:backtest:team-total-btts-competition 2026-07-28), l'offrir comme cible
// d'abonnement contredirait la discipline documentée dans goals-channel.md.
// CORRECT_SCORE/CLEAN_SHEET/WIN_EITHER_HALF testés aussi (2026-08-01) : pas
// de quoi les ajouter — CORRECT_SCORE catastrophique sur le split valid a
// tout topN, les deux autres n'ont que 13-14 jours de données exploitables.
export const SUBSCRIPTION_SOURCES: readonly SubscriptionSourceDef[] = [
  // « meilleur » retiré du libellé : mesuré sur 5 passes de régénération, le
  // rang 1 ne fait pas mieux que les suivants. C'est le coupon de plus forte
  // probabilité du jour, ce qui est descriptif et vrai.
  {
    id: 'COUPON_BEST',
    label: 'Coupon (le plus probable du jour)',
    kind: 'COUPON',
  },
  // Borné à la classe à cote courte — voir SUBSCRIPTION_COUPON_CLASS.
  {
    id: 'COUPON_ALL',
    label: 'Coupons du jour (cote courte)',
    kind: 'COUPON',
  },
  {
    id: 'CHANNEL_VALUE',
    label: 'VALUE (Valeur)',
    kind: 'CHANNEL',
    channel: 'VALUE',
    investmentMode: 'value',
    topNOptions: VALUE_TOPN_OPTIONS,
  },
  {
    id: 'CHANNEL_SAFE',
    label: 'SAFE (Sécurité)',
    kind: 'CHANNEL',
    channel: 'SAFE',
    investmentMode: 'safe',
    topNOptions: DEFAULT_CHANNEL_TOPN_OPTIONS,
  },
  {
    id: 'CHANNEL_DOMINANT',
    label: 'DOMINANT (Victoire)',
    kind: 'CHANNEL',
    channel: 'DOMINANT',
    investmentMode: 'dominant',
    topNOptions: DEFAULT_CHANNEL_TOPN_OPTIONS,
  },
  {
    id: 'CHANNEL_DRAW',
    label: 'DRAW (Nul)',
    kind: 'CHANNEL',
    channel: 'DRAW',
    investmentMode: 'draw',
    topNOptions: DEFAULT_CHANNEL_TOPN_OPTIONS,
  },
  {
    id: 'CHANNEL_BTTS',
    label: 'BTTS (BB)',
    kind: 'CHANNEL',
    channel: 'BTTS',
    investmentMode: 'btts',
    topNOptions: DEFAULT_CHANNEL_TOPN_OPTIONS,
  },
  {
    id: 'CHANNEL_TEAM_TOTAL',
    label: 'TEAM_TOTAL',
    kind: 'CHANNEL',
    channel: 'TEAM_TOTAL',
    investmentMode: 'teamTotal',
    topNOptions: DEFAULT_CHANNEL_TOPN_OPTIONS,
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

// Détail d'un abonnement (GET /subscriptions/:id) : un abonnement peut courir
// sur une saison entière, on ne veut pas resservir des centaines
// d'événements — l'historique affiché se limite aux plus récents (déjà
// triés par date desc), les compteurs cumulés (totalEvents, netPnl, …)
// restent eux calculés sur l'ensemble.
export const SUBSCRIPTION_DETAIL_EVENTS_LIMIT = 50;

export function findSubscriptionSource(
  id: string,
): SubscriptionSourceDef | undefined {
  return SUBSCRIPTION_SOURCES.find((s) => s.id === id);
}

/**
 * Classe de coupon couverte par les abonnements COUPON_ALL.
 *
 * Les classes (2026-08-22) ont fait passer la génération de 3 à 9 coupons par
 * jour. Un abonnement COUPON_ALL mise pleinement sur chacun : sans borne, un
 * abonné existant aurait vu son exposition tripler sans avoir rien demandé.
 * On le fixe donc sur la classe à cote courte, la plus proche du produit
 * auquel il a souscrit (cote ~1.94, ≈ 1 gagnant sur 2).
 *
 * `targetOddsMin` est le discriminant de classe persisté sur
 * `coupon_proposal` — voir COUPON_CLASSES (coupon.constants.ts).
 */
export const SUBSCRIPTION_COUPON_CLASS = { targetOddsMin: 1.0 } as const;
