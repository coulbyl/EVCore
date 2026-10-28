"use client";

import { useTranslations } from "next-intl";
import { formatDate, formatDateLong } from "@/lib/date";
import { useCurrencyFormat } from "@/providers/currency-provider";
import type { OperatorSummary } from "@/domains/bet-slip/use-cases/get-operator-summary";
import type { SlipsTotals } from "./bet-slip-constants";

/**
 * « Suis-je en gain ou en perte, et depuis quand ? » en deux phrases datées :
 * la période affichée, puis tout l'historique. Remplace trois tuiles sans
 * date ni effectif, dont un « Net réglé » qui ignorait le filtre Type (revue
 * UX du 2026-10-27, P2-6).
 */
export function SlipsResultLine({
  from,
  to,
  totals,
  lifetime,
}: {
  from: string;
  to: string;
  totals: SlipsTotals;
  lifetime: OperatorSummary["money"] | undefined;
}) {
  const t = useTranslations("betSlips");
  const { formatAmount, formatSigned } = useCurrencyFormat();

  return (
    <div
      data-testid="bet-slips-result"
      className="flex flex-col gap-1 text-sm leading-6"
    >
      <p className="text-foreground">
        {t("periodLine", {
          from: formatDate(from),
          to: formatDate(to),
          settled: totals.settled,
          pending: totals.pending,
        })}{" "}
        {totals.settled > 0 ? (
          <strong className="font-semibold tabular-nums">
            {t("periodMoney", {
              staked: formatAmount(totals.settledStake),
              returned: formatAmount(totals.returned),
              net: formatSigned(totals.net),
            })}
          </strong>
        ) : null}
        {totals.pendingStake > 0
          ? ` ${t("inPlay", { amount: formatAmount(totals.pendingStake) })}`
          : null}
      </p>
      {lifetime?.firstSlipAt && lifetime.settledSlips > 0 ? (
        <p className="text-muted-foreground">
          {t("lifetimeLine", {
            date: formatDateLong(lifetime.firstSlipAt),
            settled: lifetime.settledSlips,
            net: formatSigned(lifetime.net),
          })}
        </p>
      ) : null}
    </div>
  );
}
