"use client";

import { useLocale, useTranslations } from "next-intl";
import { Amount } from "@/components/amount";
import type { SubscriptionDetail } from "@/domains/subscriptions/types/subscriptions";
import { subscriptionRoiPct } from "../subscriptions-constants";
import { SubscriptionEventRow } from "./subscription-event-row";

export function SubscriptionDetailView({
  subscription,
}: {
  subscription: SubscriptionDetail;
}) {
  const t = useTranslations("subscriptions");
  const locale = useLocale();
  const roi = subscriptionRoiPct(subscription);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="grid shrink-0 grid-cols-3 gap-3 rounded-lg border border-border bg-panel-strong p-3 sm:p-4">
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
            {t("detail.statLabels.totalStaked")}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            <Amount value={subscription.totalStaked} />
          </p>
        </div>
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
            {t("detail.statLabels.netPnl")}
          </p>
          <p
            className={`mt-1 text-sm font-semibold ${
              Number(subscription.netPnl) >= 0
                ? "text-success"
                : "text-destructive"
            }`}
          >
            <Amount value={subscription.netPnl} signed />
          </p>
        </div>
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
            {t("detail.statLabels.roi")}
          </p>
          <p
            className={`mt-1 text-sm font-semibold ${
              roi === null
                ? "text-muted-foreground"
                : roi >= 0
                  ? "text-success"
                  : "text-destructive"
            }`}
          >
            {roi === null ? "—" : `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`}
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <p className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("detail.history")}
          {subscription.totalEvents > subscription.events.length
            ? ` · ${t("detail.historyLimited", { shown: subscription.events.length })}`
            : ""}
        </p>
        {subscription.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("detail.historyEmpty")}
          </p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-2 pr-1">
              {subscription.events.map((event) => (
                <SubscriptionEventRow
                  key={event.id}
                  event={event}
                  locale={locale}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
