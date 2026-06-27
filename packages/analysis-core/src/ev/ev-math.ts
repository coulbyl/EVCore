import Decimal from 'decimal.js';

// Formule EV canonique — source unique pour le service et le backtest
// EV = (probabilité estimée × cote décimale) − 1
export function calculateEV(
  probability: Decimal.Value,
  odds: Decimal.Value,
): Decimal {
  return new Decimal(probability).mul(odds).minus(1);
}

// Marge bookmaker (overround) d'un marché : Σ(1/cote) − 1.
// Les cotes décimales d'issues mutuellement exclusives somment > 1 en probas
// implicites ; l'excédent est la marge. Lève si une cote est ≤ 1 (cote décimale
// invalide) — jamais nourrir ce calcul d'une cote inventée.
export function bookmakerMargin(odds: readonly Decimal.Value[]): Decimal {
  if (odds.length === 0) {
    throw new RangeError('bookmakerMargin: empty odds array');
  }
  const total = odds.reduce<Decimal>((acc, o) => {
    const dec = new Decimal(o);
    if (dec.lte(1)) {
      throw new RangeError(
        `bookmakerMargin: invalid decimal odds ${dec.toString()}`,
      );
    }
    return acc.plus(new Decimal(1).div(dec));
  }, new Decimal(0));
  return total.minus(1);
}

// Retire la marge bookmaker : convertit un jeu de cotes d'issues mutuellement
// exclusives en probabilités « fair » qui somment exactement à 1
// (pFair_i = (1/cote_i) / Σ(1/cote_j)). C'est la référence marché à comparer au
// modèle (edge = pModel − pFair), pas la proba implicite brute 1/cote.
// Lève sur cote ≤ 1 (cf. `bookmakerMargin`).
export function removeOverround(odds: readonly Decimal.Value[]): Decimal[] {
  if (odds.length === 0) {
    throw new RangeError('removeOverround: empty odds array');
  }
  const implied = odds.map((o) => {
    const dec = new Decimal(o);
    if (dec.lte(1)) {
      throw new RangeError(
        `removeOverround: invalid decimal odds ${dec.toString()}`,
      );
    }
    return new Decimal(1).div(dec);
  });
  const total = implied.reduce((acc, p) => acc.plus(p), new Decimal(0));
  return implied.map((p) => p.div(total));
}

// Fractional Kelly stake sizing.
// Kelly formula for decimal odds: K = (p × odds − 1) / (odds − 1)
// stakePct = fraction × K, capped at maxStake.
// Returns 0 for negative or undefined Kelly (redundant guard — EV ≥ threshold
// ensures positive Kelly, but odds = 1 would cause division by zero).
export function calculateKellyStakePct(
  probability: Decimal.Value,
  odds: Decimal.Value,
  { fraction, maxStake }: { fraction: Decimal.Value; maxStake: Decimal.Value },
): Decimal {
  const p = new Decimal(probability);
  const o = new Decimal(odds);
  if (o.lte(1)) return new Decimal(0);
  const kelly = p.times(o).minus(1).dividedBy(o.minus(1));
  if (kelly.lte(0)) return new Decimal(0);
  return Decimal.min(new Decimal(fraction).times(kelly), new Decimal(maxStake));
}
