// Bloc `market` de la fiche v2 — calcul pur.
//
// Pour chacun des 7 marchés cibles : meilleure cote, cote médiane, nombre de
// bookmakers, horodatage du snapshot, probabilité implicite (brute ET
// dé-marginalisée), et mouvement de ligne réel.
//
// Ce module ne filtre rien et ne classe rien : un marché sans cote ressort
// avec `null` et un `reason`, jamais absent de la liste.

import Decimal from 'decimal.js';
import { pickLabel } from '@utils/pick-labels.utils';
import { round } from '@utils/decimal.utils';
import {
  ABSENCE_REASONS,
  TARGET_MARKETS,
  type ImpliedProbability,
  type LineMovement,
  type MarketQuote,
} from '../analysis-sheet-v2.types';

/**
 * Cotes d'un (marché, pick) chez UN bookmaker, réduites aux deux bornes utiles :
 * la plus récente et la première observée.
 */
export type BookmakerQuote = {
  market: string;
  pick: string;
  bookmaker: string;
  latestOdds: number;
  latestSnapshotAt: Date;
  firstOdds: number;
  firstSnapshotAt: Date;
  snapshotCount: number;
};

/**
 * Partition des issues d'un marché, pour retirer la marge du bookmaker.
 *
 * Seuls les marchés dont TOUTES les issues sont cotées peuvent être
 * dé-marginalisés. `TO_WIN_EITHER_HALF` n'y figure volontairement pas : HOME et
 * AWAY n'y sont pas complémentaires (les deux équipes peuvent gagner une
 * mi-temps, ou aucune) et le complément de chacune n'est pas proposé — la
 * marge n'y est donc pas estimable. Normaliser HOME+AWAY produirait un chiffre
 * faux d'allure crédible ; on rend `null` avec un motif.
 */
const OUTCOME_PARTITIONS: Record<string, Record<string, string[]>> = {
  ONE_X_TWO: {
    HOME: ['HOME', 'DRAW', 'AWAY'],
    DRAW: ['HOME', 'DRAW', 'AWAY'],
    AWAY: ['HOME', 'DRAW', 'AWAY'],
  },
  BTTS: {
    YES: ['YES', 'NO'],
    NO: ['YES', 'NO'],
  },
  OVER_UNDER: {
    OVER_1_5: ['OVER_1_5', 'UNDER_1_5'],
    UNDER_1_5: ['OVER_1_5', 'UNDER_1_5'],
    OVER: ['OVER', 'UNDER'],
    UNDER: ['OVER', 'UNDER'],
  },
};

function medianOf(values: readonly Decimal[]): Decimal | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a.comparedTo(b));
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted[mid - 1];
  const upper = sorted[mid];
  if (sorted.length % 2 === 1) return upper ?? null;
  if (!lower || !upper) return null;
  return lower.plus(upper).div(2);
}

/**
 * Probabilité implicite, marge incluse puis retirée.
 *
 * Méthode de retrait : normalisation proportionnelle — chaque `1/cote` est
 * divisé par la somme des `1/cote` de toutes les issues du marché. Choisie pour
 * sa transparence et sa stabilité : avec 1 à 4 bookmakers, Shin ou la méthode
 * logarithmique ne sont pas estimables de façon fiable. Limite connue et
 * documentée dans le type : elle sous-corrige les favoris.
 */
export function buildImpliedProbability(input: {
  market: string;
  pick: string;
  /** Cote médiane de l'issue considérée. */
  odds: number | null;
  /** Cote médiane de CHAQUE issue du marché, pour estimer la marge. */
  medianByPick: Map<string, number>;
}): ImpliedProbability {
  const { market, pick, odds, medianByPick } = input;

  if (odds === null || odds <= 1) {
    return {
      raw: null,
      deVigged: null,
      method: null,
      overround: null,
      outcomes: null,
      reason: ABSENCE_REASONS.NO_ODDS,
    };
  }

  const raw = round(new Decimal(1).div(odds));
  const partition = OUTCOME_PARTITIONS[market]?.[pick] ?? null;

  if (partition === null) {
    return {
      raw,
      deVigged: null,
      method: null,
      overround: null,
      outcomes: null,
      reason: ABSENCE_REASONS.NO_COMPLEMENT_PRICED,
    };
  }

  const implieds = partition.map((outcome) => {
    const outcomeOdds = medianByPick.get(outcome);
    return outcomeOdds !== undefined && outcomeOdds > 1
      ? new Decimal(1).div(outcomeOdds)
      : null;
  });

  // Une seule issue manquante et la marge n'est plus estimable — mieux vaut
  // ne rien annoncer que normaliser sur une partition incomplète.
  if (implieds.some((value) => value === null)) {
    return {
      raw,
      deVigged: null,
      method: null,
      overround: null,
      outcomes: partition,
      reason: ABSENCE_REASONS.NO_ODDS,
    };
  }

  const overround = implieds.reduce(
    (acc: Decimal, value) => acc.plus(value as Decimal),
    new Decimal(0),
  );

  if (overround.lessThanOrEqualTo(0)) {
    return {
      raw,
      deVigged: null,
      method: null,
      overround: null,
      outcomes: partition,
      reason: ABSENCE_REASONS.NO_ODDS,
    };
  }

  return {
    raw,
    deVigged: round(new Decimal(1).div(odds).div(overround)),
    method: 'proportional',
    overround: round(overround),
    outcomes: partition,
    reason: null,
  };
}

/**
 * Mouvement de ligne, ancré sur le PREMIER snapshot réellement disponible.
 *
 * ⚠ Ce n'est pas une cote d'ouverture de marché : l'ETL ne collecte qu'à partir
 * de J+3 (ODDS_PREMATCH_HORIZON_DAYS = 3), donc l'ancrage est typiquement à
 * ~72 h du coup d'envoi. `baselineHoursBeforeKickoff` dit exactement de quand
 * date la référence — c'est ce champ qui rend le delta interprétable.
 *
 * Convention de signe : `movement = (first − latest) / first`. Positif = la
 * cote a RACCOURCI (le marché s'est porté sur cette issue), négatif = elle
 * s'est allongée. Identique à la convention du signal historique
 * `shadow_lineMovement` du moteur, pour qu'un lecteur ne se trompe pas de sens.
 */
export function buildLineMovement(input: {
  quotes: readonly BookmakerQuote[];
  kickoff: Date;
}): LineMovement {
  const { quotes, kickoff } = input;

  if (quotes.length === 0) {
    return {
      firstOdds: null,
      firstSnapshotAt: null,
      baselineHoursBeforeKickoff: null,
      latestOdds: null,
      latestSnapshotAt: null,
      movement: null,
      snapshotCount: 0,
      reason: ABSENCE_REASONS.NO_ODDS,
    };
  }

  // Meilleure cote à chaque borne — même convention que `bestOdds`, pour que
  // le mouvement porte sur la grandeur effectivement exposée.
  const first = quotes.reduce((best, q) =>
    q.firstSnapshotAt.getTime() < best.firstSnapshotAt.getTime() ||
    (q.firstSnapshotAt.getTime() === best.firstSnapshotAt.getTime() &&
      q.firstOdds > best.firstOdds)
      ? q
      : best,
  );
  const latest = quotes.reduce((best, q) =>
    q.latestOdds > best.latestOdds ? q : best,
  );

  const snapshotCount = Math.max(...quotes.map((q) => q.snapshotCount));
  const baselineHours = round(
    new Decimal(kickoff.getTime() - first.firstSnapshotAt.getTime()).div(
      3_600_000,
    ),
  );

  const sameInstant =
    first.firstSnapshotAt.getTime() === latest.latestSnapshotAt.getTime();

  return {
    firstOdds: first.firstOdds,
    firstSnapshotAt: first.firstSnapshotAt.toISOString(),
    baselineHoursBeforeKickoff: baselineHours,
    latestOdds: latest.latestOdds,
    latestSnapshotAt: latest.latestSnapshotAt.toISOString(),
    movement:
      sameInstant || first.firstOdds <= 0
        ? null
        : round(
            new Decimal(first.firstOdds)
              .minus(latest.latestOdds)
              .div(first.firstOdds),
          ),
    snapshotCount,
    reason: sameInstant ? ABSENCE_REASONS.SINGLE_SNAPSHOT : null,
  };
}

/**
 * Les 7 marchés cibles pour un match, TOUJOURS les 7 — un marché non coté
 * ressort avec `null` et un motif, jamais omis.
 */
export function buildMarketQuotes(input: {
  quotes: readonly BookmakerQuote[];
  kickoff: Date;
}): MarketQuote[] {
  const { quotes, kickoff } = input;

  // Médiane par (marché, pick) sur TOUTES les issues rencontrées — y compris
  // les compléments (UNDER, NO, DRAW) qui ne sont pas des marchés cibles mais
  // sont nécessaires pour estimer la marge.
  const medianByMarket = new Map<string, Map<string, number>>();
  for (const quote of quotes) {
    const byPick =
      medianByMarket.get(quote.market) ?? new Map<string, number>();
    medianByMarket.set(quote.market, byPick);
  }
  for (const [market, byPick] of medianByMarket) {
    const picks = new Set(
      quotes.filter((q) => q.market === market).map((q) => q.pick),
    );
    for (const pick of picks) {
      const values = quotes
        .filter((q) => q.market === market && q.pick === pick)
        .map((q) => new Decimal(q.latestOdds));
      const median = medianOf(values);
      if (median !== null) byPick.set(pick, round(median));
    }
  }

  return TARGET_MARKETS.map(({ key, market, pick }): MarketQuote => {
    const matching = quotes.filter(
      (q) => q.market === market && q.pick === pick,
    );
    const label = pickLabel({ market, pick });

    if (matching.length === 0) {
      return {
        key: key,
        market,
        pick,
        label,
        bestOdds: null,
        bestBookmaker: null,
        medianOdds: null,
        bookmakerCount: 0,
        snapshotAt: null,
        implied: buildImpliedProbability({
          market,
          pick,
          odds: null,
          medianByPick: new Map(),
        }),
        lineMovement: buildLineMovement({ quotes: [], kickoff }),
        reason: ABSENCE_REASONS.NO_ODDS,
      };
    }

    const best = matching.reduce((acc, q) =>
      q.latestOdds > acc.latestOdds ? q : acc,
    );
    const median = medianOf(matching.map((q) => new Decimal(q.latestOdds)));
    const medianByPick =
      medianByMarket.get(market) ?? new Map<string, number>();

    return {
      key: key,
      market,
      pick,
      label,
      bestOdds: best.latestOdds,
      bestBookmaker: best.bookmaker,
      medianOdds: median !== null ? round(median) : null,
      bookmakerCount: matching.length,
      snapshotAt: best.latestSnapshotAt.toISOString(),
      implied: buildImpliedProbability({
        market,
        pick,
        odds: median !== null ? round(median) : null,
        medianByPick,
      }),
      lineMovement: buildLineMovement({ quotes: matching, kickoff }),
      reason: null,
    };
  });
}
