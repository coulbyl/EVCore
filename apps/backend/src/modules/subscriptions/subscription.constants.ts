import type { StrategyChannel } from '@evcore/db';

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
    | 'CHANNEL_DOUBLE_CHANCE'
    | 'CHANNEL_TEAM_TOTAL';
  label: string;
  kind: 'COUPON' | 'CHANNEL';
  // Canal interrogé quand channelPickMode === 'INVESTIR' : Investir classe
  // ses picks par probabilité calibrée, tous canaux sur le même tri (voir
  // InvestmentService). Il n'y a plus de « mode » par canal à référencer.
  channel?: StrategyChannel;
  // topN autorisés pour ce canal — undefined sur une source COUPON.
  topNOptions?: readonly number[];
  /**
   * Retiré du catalogue pour les NOUVEAUX abonnements, sans casser les
   * existants : leur ligne, leur historique et leurs notifications continuent
   * de fonctionner. Une source ne se retire que sur une raison de fond
   * documentée sur place — pas parce qu'un ROI a passé la tête sous zéro un
   * mois (le ROI mesuré est déjà exposé sur chaque source, à l'utilisateur de
   * juger).
   */
  retired?: true;
};

/**
 * Combien d'événements par jour un abonnement suit sur son canal.
 *
 * C'est un curseur d'EXPOSITION laissé à l'abonné, pas une règle de sélection
 * calibrée. La distinction est le fond de l'audit du 2026-08-22 : les cinq
 * plafonds `topN` d'Investir prétendaient améliorer le ROI en coupant la
 * liste, et testés en apparié aucun n'était significatif (VALUE t=+0.80,
 * TEAM_TOTAL +0.70, DOMINANT −0.50, SAFE −1.20, DRAW −1.74) — les deux plus
 * proches du seuil étant négatifs. Ces plafonds ont été supprimés d'Investir.
 *
 * Le catalogue reste fermé et identique pour tous les canaux : les valeurs
 * par canal qui vivaient ici (VALUE [1, 5], TEAM_TOTAL 3) ne s'appuyaient que
 * sur ces mêmes backtests invalidés. Un entier libre n'aurait pas plus de
 * sens — 1 seul événement/jour ne suffit pas à juger une discipline.
 */
const DEFAULT_CHANNEL_TOPN_OPTIONS = [1, 3, 5] as const;

/**
 * Catalogue fermé — voir DESIGN.md §Décisions de conception, point 1.
 *
 * DOUBLE_CHANCE ajouté le 2026-08-22 : c'est, avec DRAW, l'un des deux seuls
 * canaux sur 18 dont le ROI reste positif après shrinkage (+2.24%, n=1 431).
 * L'omettre pendant qu'on propose des canaux mesurés perdants n'était pas
 * défendable.
 *
 * GOALS reste exclu : mesuré négatif (−5.39% ROI, 15 685 sélections,
 * db:backtest:team-total-btts-competition 2026-07-28), l'offrir comme cible
 * d'abonnement contredirait la discipline documentée dans goals-channel.md.
 * CORRECT_SCORE/CLEAN_SHEET/WIN_EITHER_HALF testés aussi (2026-08-01) : pas
 * de quoi les ajouter — CORRECT_SCORE catastrophique sur le split valid à
 * tout topN, les deux autres n'ont que 13-14 jours de données exploitables.
 *
 * VALUE et SAFE restent au catalogue parce que des abonnements actifs les
 * ciblent, mais l'audit du 2026-08-22 leur retire leur justification : 92% des
 * sélections de VALUE et 95% de celles de SAFE sont des doublons exacts de
 * décisions de Phase 1, et re-sélectionner DÉGRADE la calibration (ratio
 * réalisé/annoncé 0.915 sur les picks non repris, 0.739 sur les repris). Ne
 * pas les remettre en avant avant que la réduction de VALUE à ses picks
 * propres ait été validée au niveau jambe.
 */
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
    topNOptions: DEFAULT_CHANNEL_TOPN_OPTIONS,
  },
  // Retiré le 2026-08-22. Pas pour son ROI (−6.05% shrinké, d'autres sont
  // dans le même ordre de grandeur et restent proposés) mais parce que le
  // canal n'a plus d'objet : 95% de ses sélections sont des doublons exacts
  // d'un pick de Phase 1, et ses 5% de picks propres sont les pires du
  // système (n=29, −19.7%). Ce qu'il exprimait — « haute probabilité » — se
  // lit directement sur la probabilité calibrée. S'abonner à SAFE, c'est
  // s'abonner à un sous-ensemble d'un autre canal en croyant en suivre un
  // nouveau. Voir docs/audit-canaux-investir-2026-08-22.md §2.4.
  {
    id: 'CHANNEL_SAFE',
    label: 'SAFE (Sécurité)',
    kind: 'CHANNEL',
    channel: 'SAFE',
    topNOptions: DEFAULT_CHANNEL_TOPN_OPTIONS,
    retired: true,
  },
  {
    id: 'CHANNEL_DOMINANT',
    label: 'DOMINANT (Victoire)',
    kind: 'CHANNEL',
    channel: 'DOMINANT',
    topNOptions: DEFAULT_CHANNEL_TOPN_OPTIONS,
  },
  {
    id: 'CHANNEL_DRAW',
    label: 'DRAW (Nul)',
    kind: 'CHANNEL',
    channel: 'DRAW',
    topNOptions: DEFAULT_CHANNEL_TOPN_OPTIONS,
  },
  {
    id: 'CHANNEL_BTTS',
    label: 'BTTS (BB)',
    kind: 'CHANNEL',
    channel: 'BTTS',
    topNOptions: DEFAULT_CHANNEL_TOPN_OPTIONS,
  },
  {
    id: 'CHANNEL_DOUBLE_CHANCE',
    label: 'DOUBLE_CHANCE (Double chance)',
    kind: 'CHANNEL',
    channel: 'DOUBLE_CHANCE',
    topNOptions: DEFAULT_CHANNEL_TOPN_OPTIONS,
  },
  {
    id: 'CHANNEL_TEAM_TOTAL',
    label: 'TEAM_TOTAL',
    kind: 'CHANNEL',
    channel: 'TEAM_TOTAL',
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
 * Libellé COURANT d'une source, dérivé de son `sourceType`.
 *
 * À utiliser partout où un libellé s'affiche — jamais la colonne
 * `subscription.sourceLabel`, qui est un instantané figé à la création.
 *
 * Le figeage était volontaire (« l'historique reste celui vu par
 * l'utilisateur au moment de l'abonnement »), et c'est défendable pour un
 * simple renommage. Ça s'est retourné contre nous le 2026-08-22 : deux
 * libellés étaient factuellement FAUX — « Coupon (meilleur du jour) » alors
 * que le rang 1 ne fait pas mieux que les suivants, et « chaque coupon
 * généré » alors que l'abonnement est borné à la classe à cote courte. Les
 * figer revenait à continuer d'affirmer indéfiniment, dans les notifications
 * des abonnés existants, ce qu'on venait de retirer du produit parce que
 * c'était inexact.
 *
 * Un instantané peut préserver une formulation ; il ne doit pas perpétuer une
 * erreur. L'identité d'un abonnement est son `sourceType`, pas une phrase.
 */
export function subscriptionSourceLabel(
  sourceType: string,
  fallback: string,
): string {
  return findSubscriptionSource(sourceType)?.label ?? fallback;
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
