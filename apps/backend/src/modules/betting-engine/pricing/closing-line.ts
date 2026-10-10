import Decimal from 'decimal.js';
import type { Market } from '@evcore/db';
import {
  bookmakerRank,
  closingValue,
  outcomeGroup,
  type PricedOutcome,
} from '@evcore/analysis-core';

/**
 * Une issue cotée à la clôture, telle que la vue `odds_closing_line` la
 * sert une fois le 1X2 déplié en trois lignes (cf. OddsClosingLineRepository).
 */
export type ClosingLineRow = {
  fixtureId: string;
  bookmaker: string;
  market: Market;
  pick: string;
  odds: number;
  /** Heure d'observation du prix (capture, ou `snapshotAt` avant la migration `observedAt`). */
  observedAt: Date;
};

export type ResolvedClosingLine = {
  closingOdds: number;
  closingBookmaker: string;
  /** Observation la moins fraîche du groupe retenu. */
  closingObservedAt: Date;
  closingLineValue: number;
};

/**
 * Ligne de clôture d'un pari (jambe de coupon ou sélection de canal) : le
 * book retenu, sa cote et la valeur prise.
 *
 * Le groupe d'issues doit être COMPLET chez un même book (E-1) : la marge
 * se retire à l'intérieur du groupe, et un book qui ne cote que le choix
 * joué ne dit rien de sa probabilité vraie. Parmi les books complets, on
 * prend celui qui a servi le prix quand il est connu (`oddsBookmaker` d'une
 * sélection, citation du vivier LLM d'une jambe), sinon le mieux classé
 * (`bookmakerRank`, Pinnacle d'abord) — la règle même du chargeur de cotes
 * du moteur.
 *
 * `null` si aucun book n'offre le groupe complet, ou si le marché n'a pas de
 * partition exclusive et exhaustive (`outcomeGroup`).
 */
export function resolveClosingLine(opts: {
  market: Market;
  pick: string;
  takenOdds: Decimal.Value;
  preferredBookmaker: string | null;
  rows: readonly ClosingLineRow[];
}): ResolvedClosingLine | null {
  const group = outcomeGroup(opts.market, opts.pick);
  if (!group) return null;

  const byBookmaker = new Map<string, ClosingLineRow[]>();
  for (const row of opts.rows) {
    if (row.market !== opts.market || !group.picks.includes(row.pick)) continue;
    const rows = byBookmaker.get(row.bookmaker) ?? [];
    rows.push(row);
    byBookmaker.set(row.bookmaker, rows);
  }

  const complete = [...byBookmaker.entries()]
    .filter(([, rows]) => rows.length === group.picks.length)
    .sort(([a], [b]) => {
      if (a === opts.preferredBookmaker) return -1;
      if (b === opts.preferredBookmaker) return 1;
      return bookmakerRank(a) - bookmakerRank(b) || a.localeCompare(b);
    });

  for (const [bookmaker, rows] of complete) {
    const closingOutcomes: PricedOutcome[] = rows.map((row) => ({
      pick: row.pick,
      odds: new Decimal(row.odds),
    }));
    const value = closingValue({
      takenOdds: new Decimal(opts.takenOdds),
      pick: opts.pick,
      closingOutcomes,
      outcomeTotal: group.outcomeTotal,
    });
    if (!value) continue;
    return {
      closingOdds: value.closingOdds.toNumber(),
      closingBookmaker: bookmaker,
      closingObservedAt: new Date(
        Math.min(...rows.map((r) => r.observedAt.getTime())),
      ),
      closingLineValue: value.value.toNumber(),
    };
  }
  return null;
}

/**
 * Book qui a servi le prix d'une jambe LLM, s'il est connu : le vivier
 * enregistre la citation retenue (`quote`) dans `featureSnapshot`.
 */
export function readQuotedBookmaker(featureSnapshot: unknown): string | null {
  if (!featureSnapshot || typeof featureSnapshot !== 'object') return null;
  const quote = (featureSnapshot as Record<string, unknown>)['quote'];
  if (!quote || typeof quote !== 'object') return null;
  const bookmaker = (quote as Record<string, unknown>)['bookmaker'];
  return typeof bookmaker === 'string' && bookmaker.length > 0
    ? bookmaker
    : null;
}
