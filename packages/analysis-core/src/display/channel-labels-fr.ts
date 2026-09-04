import { STRATEGY_CHANNEL, type StrategyChannel } from "../types/strategy-channel";

// French display labels for StrategyChannel codes — shared between apps/web
// (channel-constants.ts, which wraps this for its fr/en multi-locale API)
// and any other consumer that needs a human-readable canal name in French.
// Single source of truth: edit here, every consumer picks it up — mirrors
// market-labels-fr.ts's pattern for Market/pick codes. A `Record<
// StrategyChannel, string>` so TypeScript enforces exhaustiveness whenever a
// channel is added to STRATEGY_CHANNEL.
export const CHANNEL_LABELS_FR: Record<StrategyChannel, string> = {
  [STRATEGY_CHANNEL.VALUE]: "Valeur",
  [STRATEGY_CHANNEL.SAFE]: "Sécurité",
  [STRATEGY_CHANNEL.DOMINANT]: "Victoire",
  [STRATEGY_CHANNEL.BTTS]: "Les deux équipes marquent",
  [STRATEGY_CHANNEL.DRAW]: "Nul",
  [STRATEGY_CHANNEL.GOALS]: "Buts",
  [STRATEGY_CHANNEL.CLEAN_SHEET]: "Clean sheet",
  [STRATEGY_CHANNEL.TEAM_TOTAL]: "Buts par équipe",
  [STRATEGY_CHANNEL.WIN_EITHER_HALF]: "Gagne une mi-temps",
  [STRATEGY_CHANNEL.FIRST_HALF]: "1ère mi-temps",
  [STRATEGY_CHANNEL.DOUBLE_CHANCE]: "Double chance",
  [STRATEGY_CHANNEL.UNDERDOG]: "Outsider",
  [STRATEGY_CHANNEL.FAVORITE]: "Favori",
  [STRATEGY_CHANNEL.LIVE_VALUE]: "Valeur live",
  [STRATEGY_CHANNEL.MARKET_MOVE]: "Mouvement de cote",
  [STRATEGY_CHANNEL.CONSENSUS]: "Consensus",
  [STRATEGY_CHANNEL.CONTRARIAN]: "Contrarian",
  [STRATEGY_CHANNEL.AVOID]: "Attention",
  [STRATEGY_CHANNEL.CORRECT_SCORE]: "Score exact",
  [STRATEGY_CHANNEL.RESULT_TOTAL_GOALS]: "Résultat + Buts",
  [STRATEGY_CHANNEL.OVER_UNDER_HT]: "Buts 1ère MT",
  [STRATEGY_CHANNEL.RESULT_BTTS]: "Résultat + Les deux équipes marquent",
  [STRATEGY_CHANNEL.DRAW_NO_BET]: "Remboursé si nul",
  [STRATEGY_CHANNEL.WIN_TO_NIL]: "Gagne sans encaisser",
  [STRATEGY_CHANNEL.HALF_TIME_FULL_TIME]: "Mi-temps / Fin de match",
  [STRATEGY_CHANNEL.VANTAGE]: "Arbitrage",
};

export function formatChannelForDisplayFr(channel: StrategyChannel): string {
  return CHANNEL_LABELS_FR[channel];
}
