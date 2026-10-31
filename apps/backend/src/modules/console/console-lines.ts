import type { LightKey, TodoItem } from './console.types';

/** The lights' names, as the admin home says them. */
export const LIGHT_NAMES: Record<LightKey, string> = {
  data: 'Données',
  engine: 'Moteur',
  players: 'Joueurs',
};

const since = (hours: number | null) =>
  hours === null ? 'jamais' : `depuis ${hours} h`;

/**
 * A line of « À faire » in French, for the red-light e-mail. The screen
 * writes its own (web messages `console.todo`), the same sentences.
 */
export function todoLineOf(item: TodoItem): string {
  switch (item.kind) {
    case 'odds_stale':
      return `Aucune cote relevée ${since(item.hours)}`;
    case 'quota':
      return `Quota API-Football au seuil : ${item.detail}`;
    case 'etl_failed':
      return `${item.count} passe(s) en échec : ${item.last}`;
    case 'stats_late':
      return `${item.fixtures} matchs sans stats depuis plus de 3 jours, ${item.competitions} championnat(s) fiable(s)`;
    case 'coupons_missing':
      return `Aucun coupon pour demain, ${item.forDate}`;
    case 'analysis_stopped':
      return `Analyse arrêtée : dernier passage ${since(item.hours)}`;
    case 'product_absent':
      return `${item.product} absent ${item.days} jours sur ${item.window}`;
    case 'market_suspended':
      return `${item.market} suspendu depuis le ${item.since}`;
    case 'ai_silent':
      return `L'IA n'a rien publié ${since(item.hours)}`;
    case 'players_silent':
      return `Aucun joueur venu ${since(item.hours)}`;
    case 'support_unanswered':
      return `${item.count} message(s) sans réponse depuis plus de 24 h`;
  }
}
