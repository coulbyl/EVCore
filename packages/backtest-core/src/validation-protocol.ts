/**
 * Protocole de sélection puis validation (chantier E, tâche E-11).
 *
 * POURQUOI. Toutes les illusions produites pendant l'audit du 2026-09-15
 * viennent du même geste : choisir une configuration en regardant ses
 * résultats, puis annoncer ces mêmes résultats. Un balayage de 120
 * configurations produit mécaniquement un gagnant, et son écart est du bruit
 * jusqu'à preuve du contraire.
 *
 * Ce module force la séquence correcte :
 *   1. la grille et le critère sont des données passées à la fonction, donc
 *      figées avant l'exécution ;
 *   2. le choix se fait sur la fenêtre de sélection, et sur elle seule ;
 *   3. la configuration retenue est évaluée UNE fois sur la fenêtre de
 *      validation, qui n'a servi à rien d'autre.
 *
 * Le résultat porte les deux mesures côte à côte : c'est leur ÉCART qui dit si
 * la configuration a survécu, pas la seconde prise isolément.
 */

export type ProtocolWindow = {
  /** Première journée incluse, au format ISO court. Ouvert si absent. */
  from?: string;
  /** Première journée exclue. Ouvert si absent. */
  to?: string;
};

export type ProtocolInput<TConfig, TSummary> = {
  /** Grille figée. Aucune configuration ne doit être ajoutée après coup. */
  grid: readonly TConfig[];
  /** Coupure : tout ce qui précède sert à choisir, le reste à valider. */
  splitDate: string;
  /**
   * Évalue une configuration sur une fenêtre. Doit être déterministe : deux
   * appels identiques donnent le même résumé.
   */
  evaluate: (config: TConfig, window: ProtocolWindow) => TSummary | null;
  /**
   * Critère de choix, déclaré d'avance. Plus grand est meilleur. Il ne doit
   * dépendre que du résumé — introduire ici une préférence implicite
   * ("et si le ROI est positif") contournerait tout le protocole.
   */
  criterion: (summary: TSummary) => number;
  /** Volume minimal sous lequel une configuration n'est pas éligible. */
  isEligible: (summary: TSummary) => boolean;
};

export type ProtocolOutcome<TConfig, TSummary> = {
  /** Toutes les configurations éligibles, avec leur résumé de sélection. */
  selection: Array<{ config: TConfig; summary: TSummary; score: number }>;
  /** Configuration retenue, ou `null` si aucune n'est éligible. */
  chosen: TConfig | null;
  /** Résumé de la configuration retenue sur la fenêtre de sélection. */
  selectionSummary: TSummary | null;
  /** Résumé de la configuration retenue sur la fenêtre de validation. */
  validationSummary: TSummary | null;
  /** Nombre de configurations réellement comparées. */
  configurationsCompared: number;
  /**
   * Nombre de configurations dont l'écart paraîtrait significatif à 95 % par
   * le seul effet du balayage. À afficher à côté de tout décompte de
   * gagnants : sans lui, un lecteur croit à un signal là où il y a du tirage.
   */
  falsePositivesExpected: number;
};

/**
 * Exécute le protocole. La fonction ne juge pas le résultat : elle garantit
 * seulement que le choix et la mesure n'ont pas utilisé les mêmes journées.
 */
export function runValidationProtocol<TConfig, TSummary>(
  input: ProtocolInput<TConfig, TSummary>,
): ProtocolOutcome<TConfig, TSummary> {
  const selectionWindow: ProtocolWindow = { to: input.splitDate };
  const validationWindow: ProtocolWindow = { from: input.splitDate };

  const selection = input.grid.flatMap((config) => {
    const summary = input.evaluate(config, selectionWindow);
    if (summary === null || !input.isEligible(summary)) return [];
    return [{ config, summary, score: input.criterion(summary) }];
  });

  const ranked = [...selection].sort((first, second) => second.score - first.score);
  const winner = ranked[0] ?? null;

  return {
    selection,
    chosen: winner?.config ?? null,
    selectionSummary: winner?.summary ?? null,
    validationSummary: winner
      ? input.evaluate(winner.config, validationWindow)
      : null,
    configurationsCompared: selection.length,
    falsePositivesExpected: selection.length * 0.025,
  };
}

/**
 * Vrai si une journée appartient à la fenêtre. Bornes volontairement
 * asymétriques — `from` inclus, `to` exclu — pour qu'une journée ne puisse
 * jamais servir à la fois au choix et à la validation.
 */
export function isWithinWindow(day: string, window: ProtocolWindow): boolean {
  if (window.from !== undefined && day < window.from) return false;
  if (window.to !== undefined && day >= window.to) return false;
  return true;
}
