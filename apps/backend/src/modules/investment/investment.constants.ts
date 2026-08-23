import { STRATEGY_CHANNEL } from '@modules/betting-engine/channel-strategy.types';
import type { StrategyChannel } from '@modules/betting-engine/channel-strategy.types';

/**
 * Les trois vues d'Investir — voir docs/audit-canaux-investir-2026-08-22.md §5.
 *
 * Investir n'est plus une surface de revue exhaustive (18 modes, un par
 * canal) mais un point de filtre unique, et un filtre se juge à ce qu'il
 * EXCLUT, pas à ce qu'il expose :
 *
 * - `assumed` — les canaux dont le ROI shrinké est positif. Mesuré le
 *   2026-08-22 sur 54 614 sélections réglées : 2 canaux sur 18 seulement
 *   (DOUBLE_CHANCE +2.24%, DRAW +0.74%). La liste n'est PAS codée en dur,
 *   elle se recalcule (InvestmentChannelStatsRepository) — une liste figée
 *   ment dès que les données bougent, ce que faisait `NEGATIVE_ROI_CHANNELS`
 *   (2 canaux nommés le 2026-07-06 alors que 16 sur 18 sont négatifs).
 * - `watch` — tout le reste, une seule liste filtrable par canal, chaque pick
 *   portant le ROI shrinké de son canal. Pas un onglet par canal : une
 *   colonne.
 * - `excluded` — ce que les garde-fous ont retiré, et pourquoi. C'est la vue
 *   qui manquait, et c'est celle qui rend le filtre auditable.
 */
export const INVESTMENT_VIEWS = ['assumed', 'watch', 'excluded'] as const;
export type InvestmentView = (typeof INVESTMENT_VIEWS)[number];

/**
 * Canaux consultables dans Investir : tout ce qui émet une décision
 * individuelle réglable.
 *
 * Exclus volontairement :
 * - les méta-canaux (CONSENSUS, CONTRARIAN, AVOID) — ils agrègent les
 *   sélections des autres au lieu de prendre une position propre. CONSENSUS
 *   a en plus cessé d'émettre le 2026-08-22 (son `maxProbability` était biaisé
 *   vers le haut par construction : ratio 0.726 alors qu'il agrège DOMINANT à
 *   0.918). AVOID reste actif, mais comme garde-fou d'exclusion, pas comme
 *   pick.
 * - CORRECT_SCORE — volume réglé quasi nul et ROI négatif (voir
 *   docs/ml-worker-sync.md).
 * - UNDERDOG / FAVORITE / LIVE_VALUE / MARKET_MOVE — jamais implémentés en
 *   stratégie, aucune décision en base.
 */
export const INVESTMENT_CHANNELS = [
  STRATEGY_CHANNEL.VALUE,
  STRATEGY_CHANNEL.SAFE,
  STRATEGY_CHANNEL.DOMINANT,
  STRATEGY_CHANNEL.BTTS,
  STRATEGY_CHANNEL.DRAW,
  STRATEGY_CHANNEL.GOALS,
  STRATEGY_CHANNEL.TEAM_TOTAL,
  STRATEGY_CHANNEL.CLEAN_SHEET,
  STRATEGY_CHANNEL.WIN_EITHER_HALF,
  STRATEGY_CHANNEL.FIRST_HALF,
  STRATEGY_CHANNEL.DOUBLE_CHANCE,
  STRATEGY_CHANNEL.RESULT_TOTAL_GOALS,
  STRATEGY_CHANNEL.OVER_UNDER_HT,
  STRATEGY_CHANNEL.RESULT_BTTS,
  STRATEGY_CHANNEL.DRAW_NO_BET,
  STRATEGY_CHANNEL.WIN_TO_NIL,
  STRATEGY_CHANNEL.HALF_TIME_FULL_TIME,
] as const satisfies readonly StrategyChannel[];

/**
 * Pourquoi un pick a été retiré. Une seule raison est reportée par pick — la
 * première rencontrée dans l'ordre d'évaluation du service — parce que la vue
 * « Écarté » répond à « pourquoi celui-là n'est pas dans la liste », pas à
 * « combien de règles il enfreint ».
 */
export const EXCLUSION_REASON = {
  /** AVOID a été SELECTED sur ce match : divergence modèle↔marché implausible. */
  AVOID: 'AVOID',
  /** Garde-fou de cohérence modèle↔marché déclenché sur le match. */
  CALIBRATION_ALERT: 'CALIBRATION_ALERT',
  /** Pick GOALS Over/Under contredisant le lambda Poisson du modèle. */
  LAMBDA_INCOHERENT: 'LAMBDA_INCOHERENT',
  /** Edge calibré au-delà de MAX_LEG_EDGE — voir INVESTMENT_GUARDRAILS. */
  EDGE_TOO_HIGH: 'EDGE_TOO_HIGH',
  /** Cote sous MIN_LEG_ODDS. */
  ODDS_TOO_SHORT: 'ODDS_TOO_SHORT',
} as const;

export type ExclusionReason =
  (typeof EXCLUSION_REASON)[keyof typeof EXCLUSION_REASON];

export const INVESTMENT_LIMITS = {
  /**
   * « Ce qu'on assume » est une surface de MISE : elle reste plafonnée. C'est
   * le seul plafond survivant à la suppression de `topN` — global, pas par
   * canal, et donc pas une règle de sélection choisie parmi plusieurs
   * variantes testées (voir le commentaire de INVESTMENT_GUARDRAILS).
   */
  assumedMaxPicks: 15,
  /**
   * « En observation » et « Écarté » sont des surfaces de REVUE : les
   * plafonner reviendrait à cacher ce qu'on prétend rendre auditable. Le
   * plafond ici n'existe que pour borner le rendu d'une page.
   */
  reviewMaxPicks: 300,
} as const;

/**
 * Fenêtre de mesure des statistiques par canal (courbe de fiabilité + ROI
 * shrinké).
 *
 * `null` = tout l'historique disponible avant la date consultée. Volontaire :
 * l'ancienne fenêtre glissante de 180 jours servait un correcteur à décalage
 * constant (`meanError`) qui devait suivre une dérive ; la courbe de Platt
 * ajuste une PENTE, et le shrinkage vers le poolé gère les canaux fins de
 * façon continue. Découper l'historique en tranches est précisément l'erreur
 * que l'audit documente (§6, « ne pas lire une tranche annuelle comme une
 * tendance »).
 */
export const INVESTMENT_STATS_WINDOW_DAYS: number | null = null;

/**
 * Les deux garde-fous remontés du coupon vers Investir (audit §5.4) pour
 * qu'ils s'appliquent à TOUTE surface de mise, pas seulement au coupon.
 *
 * Ce sont des caractéristiques du pick, pas un historique de résultats
 * découpé en tranches — la seule famille de signal qui ait jamais tenu ici
 * (voir AVOID et le détecteur d'incohérence lambda).
 *
 * `maxEdge` : l'edge revendiqué (`p − 1/cote`) est ANTI-prédictif. Mesuré sur
 * 51 860 sélections, le taux réel est plat (0.511 → 0.375) pendant que
 * l'annoncé grimpe de 0.481 à 0.699 ; la tranche > 0.25 ne réalise que 0.537
 * de ce qu'elle annonce. L'edge ne mesure pas un avantage, il mesure
 * l'ampleur de l'erreur du modèle. Conséquence assumée : les picks VALUE, que
 * `VALUE_MIN_EDGE = 0.10` sélectionne justement au-dessus de ce seuil,
 * atterrissent massivement dans « Écarté » — c'est le constat, pas un effet de
 * bord.
 *
 * `minOdds` : sous 1.20, la bande 1.10–1.20 est la pire des cotes courtes
 * (ROI/jambe −5.17% sur 742 jambes) et produit des positions dont le retour ne
 * justifie pas la mise.
 */
export const INVESTMENT_GUARDRAILS = {
  maxEdge: 0.1,
  minOdds: 1.2,
} as const;

/**
 * OVER_UNDER pick code -> ligne de buts. Sert à détecter les picks GOALS dont
 * la direction contredit le lambda Poisson du modèle (voir
 * InvestmentCoherenceRepository) — vérifié le 2026-07-06 sur l'historique
 * réglé : le taux de réussite chute de 7 à 9pp quand le pick contredit lambda,
 * sur des milliers de cas.
 */
export const OVER_UNDER_LINES: Record<string, number> = {
  OVER_1_5: 1.5,
  UNDER_1_5: 1.5,
  OVER: 2.5,
  UNDER: 2.5,
  OVER_3_5: 3.5,
  UNDER_3_5: 3.5,
  OVER_4_5: 4.5,
  UNDER_4_5: 4.5,
};
