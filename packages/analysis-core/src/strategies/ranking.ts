import type Decimal from "decimal.js";

/**
 * Classement des lignes candidates d'un canal multi-lignes (GOALS,
 * DOUBLE_CHANCE, OVER_UNDER_HT, TEAM_TOTAL, RESULT_TOTAL_GOALS, RESULT_BTTS).
 *
 * `ev` (défaut, comportement historique) : EV décroissante entre candidats
 * pricés, les non-pricés après, probabilité en départage. L'audit du
 * 2026-08-22 a mesuré l'edge annoncé comme anti-prédictif : à cote égale,
 * maximiser p × cote − 1 retient la ligne où le modèle s'écarte le plus du
 * prix, c'est-à-dire celle où il se trompe le plus.
 *
 * `probability_in_band` (candidat à l'étude, 2026-10-06) : seules les lignes
 * pricées dans la bande de cote [min, max[ sont admissibles, classées par
 * probabilité décroissante, EV en départage. Classer par probabilité SANS
 * bande choisirait toujours la ligne la plus probable (UNDER 4.5 à 1,05),
 * ce que le commentaire historique de GoalsStrategy interdisait déjà ; la
 * bande est celle où la calibration par jambe tient (CLAUDE.md : 0,899 sous
 * 1,45, 0,836 jusqu'à 1,80, 0,619 au-delà). Aucune candidate dans la bande
 * = pas de sélection.
 *
 * Le défaut reste `ev` tant que le rejeu par canal n'a pas tranché
 * (packages/backtest-core/scripts/backtest-strategy-ranking.ts).
 */
export type LineRanking = "ev" | "probability_in_band";

export type RankingOptions = {
  ranking?: LineRanking;
  /** Bande de cote admissible en mode `probability_in_band`, [min, max[. */
  band?: { min: number; max: number };
};

export const DEFAULT_RANKING_BAND = { min: 1.2, max: 1.8 } as const;

type Rankable = {
  probability: Decimal;
  priced: { odds?: Decimal; ev?: Decimal };
};

function compareByEv(a: Rankable, b: Rankable): number {
  const aEv = a.priced.ev ?? null;
  const bEv = b.priced.ev ?? null;
  if (aEv !== null && bEv !== null) return bEv.comparedTo(aEv);
  if (aEv !== null) return -1;
  if (bEv !== null) return 1;
  return b.probability.comparedTo(a.probability);
}

function compareByProbability(a: Rankable, b: Rankable): number {
  const delta = b.probability.comparedTo(a.probability);
  if (delta !== 0) return delta;
  return compareByEv(a, b);
}

/** Candidats classés, meilleur en tête. Peut être vide en mode bande. */
export function rankLineCandidates<T extends Rankable>(
  candidates: readonly T[],
  options: RankingOptions = {},
): T[] {
  const ranking = options.ranking ?? "ev";
  if (ranking === "ev") return [...candidates].sort(compareByEv);

  const band = options.band ?? DEFAULT_RANKING_BAND;
  return candidates
    .filter(
      (candidate) =>
        candidate.priced.odds !== undefined &&
        candidate.priced.odds.gte(band.min) &&
        candidate.priced.odds.lt(band.max),
    )
    .sort(compareByProbability);
}
