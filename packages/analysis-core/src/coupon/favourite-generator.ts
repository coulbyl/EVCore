import { FAVOURITE_COUPON_CLASS } from "./coupon-classes";

/**
 * Générateur du pari sûr du jour (règle « generator-v2 », voir
 * FAVOURITE_COUPON_CLASS pour la mesure qui la justifie).
 *
 * Il ne lit que le prix : parmi les rencontres pas encore jouées, le favori à
 * domicile (1X2, pick HOME) à la cote la plus basse dans la bande. Le tri est
 * total (cote, puis identifiant de rencontre) pour que deux exécutions sur le
 * même vivier donnent la même jambe. Hors bande, il s'abstient : l'abstention
 * est un résultat, pas une panne.
 */
export type FavouriteCandidate = {
  fixtureId: string;
  market: string;
  pick: string;
  odds: number;
};

export type FavouriteSelection =
  | { outcome: "picked"; leg: FavouriteCandidate; candidateCount: number }
  | {
      outcome: "abstained";
      reason: "no_home_favourite_in_band";
      candidateCount: number;
    };

export const FAVOURITE_MARKET = "ONE_X_TWO";
export const FAVOURITE_PICK = "HOME";

export function pickHomeFavourite(
  candidates: readonly FavouriteCandidate[],
  band: { minOdds: number; maxOdds: number } = {
    minOdds: FAVOURITE_COUPON_CLASS.minLegOdds,
    maxOdds: FAVOURITE_COUPON_CLASS.maxLegOdds,
  },
): FavouriteSelection {
  const inBand = candidates
    .filter(
      (c) =>
        c.market === FAVOURITE_MARKET &&
        c.pick === FAVOURITE_PICK &&
        Number.isFinite(c.odds) &&
        c.odds >= band.minOdds &&
        c.odds <= band.maxOdds,
    )
    .sort((a, b) => a.odds - b.odds || a.fixtureId.localeCompare(b.fixtureId));
  const leg = inBand[0];
  if (!leg) {
    return {
      outcome: "abstained",
      reason: "no_home_favourite_in_band",
      candidateCount: inBand.length,
    };
  }
  return { outcome: "picked", leg, candidateCount: inBand.length };
}
