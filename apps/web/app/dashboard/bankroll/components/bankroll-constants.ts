import type { useTranslations } from "next-intl";
import { formatDateShort } from "@/lib/date";
import { formatPickWithTeams } from "@/helpers/fixture";
import type {
  BankrollTransaction,
  BankrollTransactionType,
} from "@/domains/bankroll/types/bankroll";

export type Translator = ReturnType<typeof useTranslations>;

export type EnrichedTransaction = BankrollTransaction & {
  balanceAfter: number;
  detailLabel: string;
};

export type TrendPoint = {
  day: string;
  label: string;
  balance: number;
};

export function parseAmount(value: string): number {
  return Number.parseFloat(value);
}

export function toIsoDay(value: string): string {
  return value.slice(0, 10);
}

/** « Retour » et non « Gain » : le montant crédité contient la mise. */
export function transactionTypeLabel(
  type: BankrollTransactionType,
  t: Translator,
): string {
  switch (type) {
    case "DEPOSIT":
      return t("filter.deposit");
    case "BET_PLACED":
      return t("filter.stake");
    case "BET_WON":
      return t("filter.return");
    case "BET_VOID":
      return t("filter.refund");
    default:
      return type;
  }
}

/**
 * Ce qui a été joué, écrit pour le joueur. Un combiné est rattaché en base à
 * sa première jambe : sans cette étape, « Arsenal–Burnley + Ajax–PSV »
 * s'affichait « Ajax vs PSV (Résultat) » (revue UX du 2026-10-27, P2-7).
 */
export function transactionDetail(
  transaction: BankrollTransaction,
  t: Translator,
): string {
  if (transaction.type === "DEPOSIT") {
    return transaction.note || t("fallback.deposit");
  }
  if (transaction.comboLegs !== null) {
    return t("detail.combo", { count: transaction.comboLegs });
  }
  if (
    transaction.pick &&
    transaction.market &&
    transaction.homeTeam &&
    transaction.awayTeam
  ) {
    const pick = formatPickWithTeams(transaction.pick, transaction.market, {
      home: transaction.homeTeam,
      away: transaction.awayTeam,
    });
    return `${pick} · ${transaction.homeTeam} – ${transaction.awayTeam}`;
  }
  return transaction.note || t("fallback.bet");
}

/**
 * « Solde après » se calcule à rebours depuis le solde actuel : il faut donc
 * partir du mouvement le plus récent, quel que soit l'ordre reçu.
 */
export function enrichTransactions(
  transactions: readonly BankrollTransaction[],
  currentBalance: number,
  t: Translator,
): EnrichedTransaction[] {
  const newestFirst = [...transactions].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  let runningBalance = currentBalance;
  return newestFirst.map((transaction) => {
    const row = {
      ...transaction,
      balanceAfter: runningBalance,
      detailLabel: transactionDetail(transaction, t),
    };
    runningBalance -= parseAmount(transaction.amount);
    return row;
  });
}

/** Le solde en fin de journée, du plus ancien au plus récent. */
export function buildTrendPoints(rows: EnrichedTransaction[]): TrendPoint[] {
  const byDay = new Map<string, TrendPoint>();
  for (const row of [...rows].reverse()) {
    const day = toIsoDay(row.createdAt);
    byDay.set(day, {
      day,
      label: formatDateShort(day),
      balance: row.balanceAfter,
    });
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}
