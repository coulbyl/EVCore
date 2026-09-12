// Filtres d'export v2 — appliqués aux matchs AVANT rendu.
//
// La fiche pèse 13,6 Mo sur une plage de trois jours. Ces filtres existent pour
// la réduire, pas pour sélectionner : ils sont déclaratifs, leurs valeurs sont
// rendues dans `exportOptions`, et aucun d'eux n'est actif par défaut.

import type { AnalysisSheetFixture } from './analysis-sheet.repository';

export type ExportFilters = {
  /** Statuts de match conservés. null = tous. */
  statuses: string[] | null;
  /** Marchés conservés dans les picks. null = tous. */
  markets: string[] | null;
  /** Canaux retirés de la fiche, ex. ["CORRECT_SCORE"]. null = aucun. */
  excludeChannels: string[] | null;
};

export const NO_EXPORT_FILTERS: ExportFilters = {
  statuses: null,
  markets: null,
  excludeChannels: null,
};

/**
 * Applique les filtres d'export.
 *
 * `excludeChannels` retire les décisions du canal visé ET, quand le canal est
 * le seul à porter un marché, les picks évalués correspondants restent : un
 * pick évalué n'appartient à aucun canal, il appartient au match. Retirer
 * CORRECT_SCORE retire donc ses décisions, pas la structure du match.
 */
export function applyExportFilters(
  fixtures: readonly AnalysisSheetFixture[],
  filters: ExportFilters,
): AnalysisSheetFixture[] {
  const statuses = filters.statuses ? new Set(filters.statuses) : null;
  const markets = filters.markets ? new Set(filters.markets) : null;
  const excluded = filters.excludeChannels
    ? new Set(filters.excludeChannels)
    : null;

  return fixtures
    .filter((fixture) => statuses === null || statuses.has(fixture.status))
    .map((fixture) => {
      if (excluded === null && markets === null) return fixture;

      const keepSelection = (selection: {
        channel: string;
        market: string | null;
      }): boolean => {
        if (excluded !== null && excluded.has(selection.channel)) return false;
        // Une décision sans marché (AVOID, CONSENSUS, un canal rejeté) n'est
        // pas concernée par un filtre de marché : la retirer masquerait un
        // drapeau, ce qui serait une perte de diagnostic.
        if (markets !== null && selection.market !== null) {
          return markets.has(selection.market);
        }
        return true;
      };

      return {
        ...fixture,
        selections: fixture.selections.filter(keepSelection),
        priorPasses: fixture.priorPasses.map((pass) => ({
          ...pass,
          selectedPicks: pass.selectedPicks.filter(keepSelection),
        })),
        features: filterFeatureEvaluatedPicks(fixture.features, markets),
      };
    });
}

/**
 * Restreint `features.evaluatedPicks` aux marchés demandés.
 *
 * Passe par les features plutôt que par le JSON rendu parce que c'est la
 * source unique d'`evaluatedPicks` : filtrer en aval laisserait la v1 et la v2
 * diverger sur le même export.
 */
function filterFeatureEvaluatedPicks(
  features: unknown,
  markets: Set<string> | null,
): unknown {
  if (markets === null) return features;
  if (!features || typeof features !== 'object') return features;

  const record = features as Record<string, unknown>;
  const picks = record['evaluatedPicks'];
  if (!Array.isArray(picks)) return features;

  return {
    ...record,
    evaluatedPicks: picks.filter((pick) => {
      if (!pick || typeof pick !== 'object') return false;
      const market = (pick as Record<string, unknown>)['market'];
      return typeof market === 'string' && markets.has(market);
    }),
  };
}
