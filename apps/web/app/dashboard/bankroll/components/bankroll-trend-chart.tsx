"use client";

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@evcore/ui";
import { useTranslations } from "next-intl";
import { useCurrencyFormat } from "@/providers/currency-provider";
import { EvAreaChart } from "@/components/charts/ev-area-chart";
import type { TrendPoint } from "./bankroll-constants";

/**
 * Le solde déclaré, jour par jour, et la mise en garde qui va avec : un
 * dépôt fait monter la courbe sans rien gagner (revue UX du 2026-10-27,
 * P2-9). Plus de « Évolution récente » qui répétait le solde, ni de « Jours
 * affichés ».
 */
export function BankrollTrendChart({ points }: { points: TrendPoint[] }) {
  const t = useTranslations("bankrollPage");
  const { formatAmount } = useCurrencyFormat();

  if (points.length === 0) {
    return (
      <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
        <EmptyHeader>
          <EmptyTitle>{t("trend.notEnoughData")}</EmptyTitle>
          <EmptyDescription>
            {t("trend.notEnoughDataDescription")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div className="p-4 sm:p-5">
      <EvAreaChart
        data={points}
        xKey="label"
        yKey="balance"
        color="var(--accent)"
        height={160}
        yAxisWidth={72}
        fitDomain
        valueLabel={t("trend.valueLabel")}
        formatY={(v) => formatAmount(v, true)}
      />
      {first && last ? (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          {t("trend.range", { from: first.label, to: last.label })}
        </p>
      ) : null}
    </div>
  );
}
