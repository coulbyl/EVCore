import { StrategyChannel } from '@evcore/db';

/**
 * Canaux exclus du suivi de performance.
 *
 * Défini par EXCLUSION, jamais par une liste positive de canaux « suivis ».
 * C'est une correction du 2026-08-22 : le suivi énumérait 10 canaux en dur,
 * écrits à une époque où les autres n'émettaient pas encore de décision
 * réglée. Depuis, 8 canaux supplémentaires produisent des résultats — plus de
 * 160 000 sélections réglées — et n'apparaissaient nulle part, dont
 * DOUBLE_CHANCE, le mieux mesuré du système.
 *
 * Une liste positive se périme en silence à chaque canal ajouté : rien ne
 * casse, la page affiche simplement moins que la réalité. Une liste
 * d'exclusion, non.
 *
 * Ce qui est exclu, et pourquoi :
 * - CONSENSUS / CONTRARIAN / AVOID : méta-canaux, ils lisent les décisions des
 *   autres au lieu d'émettre une position propre. CONSENSUS a en plus cessé
 *   d'émettre des sélections le 2026-08-22.
 * - UNDERDOG / FAVORITE / LIVE_VALUE / MARKET_MOVE : déclarés dans l'enum mais
 *   jamais implémentés en stratégie, aucune décision en base.
 */
const UNTRACKED_CHANNELS: ReadonlySet<StrategyChannel> = new Set([
  StrategyChannel.CONSENSUS,
  StrategyChannel.CONTRARIAN,
  StrategyChannel.AVOID,
  StrategyChannel.UNDERDOG,
  StrategyChannel.FAVORITE,
  StrategyChannel.LIVE_VALUE,
  StrategyChannel.MARKET_MOVE,
]);

/** Tout canal qui prend une position propre — la seule source de la liste. */
export const TRACKED_CHANNELS: readonly StrategyChannel[] = (
  Object.values(StrategyChannel) as StrategyChannel[]
).filter((channel) => !UNTRACKED_CHANNELS.has(channel));

/**
 * Métrique mise en avant sur la carte de santé d'un canal.
 *
 * Le taux de réussite est le défaut : il est lisible sans contexte et il ne
 * dépend pas de la cote. Le ROI n'est mis en avant que pour DRAW, dont le
 * taux de réussite (~31%) se lit très mal seul — c'est normal pour un canal
 * qui joue le nul à cote longue, et l'afficher en premier donnerait
 * l'impression d'un canal défaillant alors qu'il est le mieux calibré du
 * système.
 */
export const PRIMARY_METRIC_BY_CHANNEL: Partial<
  Record<StrategyChannel, 'ROI' | 'HIT_RATE'>
> = {
  [StrategyChannel.DRAW]: 'ROI',
};
