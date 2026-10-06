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
 * `probability_in_band` (2026-10-06) : une ligne pricée n'est admissible que
 * dans la bande de cote [min, max[, les admissibles sont classées par
 * probabilité décroissante, EV en départage. Classer par probabilité SANS
 * bande choisirait toujours la ligne la plus probable (UNDER 4.5 à 1,05),
 * ce que le commentaire historique de GoalsStrategy interdisait déjà ; la
 * bande est celle où la calibration par jambe tient (CLAUDE.md : 0,899 sous
 * 1,45, 0,836 jusqu'à 1,80, 0,619 au-delà). Une ligne pricée HORS bande
 * n'est jamais jouée. Une ligne sans prix reste une observation : elle
 * vient après toutes les lignes pricées de la bande, comme en mode `ev`,
 * pour que les canaux en observation continuent d'enregistrer leur lecture
 * quand le book ne cote pas.
 *
 * Quel canal utilise quelle règle : PRODUCTION_LINE_RANKING ci-dessous.
 */
export type LineRanking = "ev" | "probability_in_band";

export type RankingOptions = {
  ranking?: LineRanking;
  /** Bande de cote admissible en mode `probability_in_band`, [min, max[. */
  band?: { min: number; max: number };
};

export const DEFAULT_RANKING_BAND = { min: 1.2, max: 1.8 } as const;

/**
 * Règle de classement en production, par canal (2026-10-06,
 * packages/backtest-core/scripts/backtest-strategy-ranking.ts, rapport
 * docs/audits/2026-10-06/strategy-ranking.txt).
 *
 * Rejeu sur la chaîne de production, 20 246 matchs, décision à coup
 * d'envoi − 1 h. Sur la fenêtre 2026, qui n'a servi à rien d'autre, le ratio
 * réalisé/annoncé passe de 0,923 à 0,973 pour GOALS (n ≈ 5 000), de 0,873 à
 * 0,920 pour TEAM_TOTAL (n ≈ 3 500), de 0,948 à 0,958 pour OVER_UNDER_HT
 * (n ≈ 900) ; GOALS confirme sur 2025 (0,944 → 1,047). Le ROI ne bouge pas
 * dans le bruit : la règle annonce moins faux, elle ne bat pas le prix.
 * DOUBLE_CHANCE ne gagne rien (0,935 → 0,928) et RESULT_TOTAL_GOALS /
 * RESULT_BTTS n'ont presque jamais de ligne dans la bande (93 et 33 picks
 * sur 9 483) : ils restent en EV, en observation.
 */
export const PRODUCTION_LINE_RANKING: Readonly<
  Record<
    | "GOALS"
    | "DOUBLE_CHANCE"
    | "OVER_UNDER_HT"
    | "TEAM_TOTAL"
    | "RESULT_TOTAL_GOALS"
    | "RESULT_BTTS",
    RankingOptions
  >
> = {
  GOALS: { ranking: "probability_in_band" },
  TEAM_TOTAL: { ranking: "probability_in_band" },
  OVER_UNDER_HT: { ranking: "probability_in_band" },
  DOUBLE_CHANCE: { ranking: "ev" },
  RESULT_TOTAL_GOALS: { ranking: "ev" },
  RESULT_BTTS: { ranking: "ev" },
};

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
  const inBand = candidates
    .filter(
      (candidate) =>
        candidate.priced.odds !== undefined &&
        candidate.priced.odds.gte(band.min) &&
        candidate.priced.odds.lt(band.max),
    )
    .sort(compareByProbability);
  const unpriced = candidates
    .filter((candidate) => candidate.priced.odds === undefined)
    .sort(compareByProbability);
  return [...inBand, ...unpriced];
}

/** Reason code when a band-mode ranking leaves nothing to select. */
export function noCandidateReason(options: RankingOptions = {}): string {
  return options.ranking === "probability_in_band"
    ? "no_priced_line_in_band"
    : "no_candidates";
}
