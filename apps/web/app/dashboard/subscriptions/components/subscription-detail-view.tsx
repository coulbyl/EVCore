"use client";

import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@evcore/ui";
import { Amount } from "@/components/amount";
import { formatDateTime } from "@/lib/date";
import type { SubscriptionDetail } from "@/domains/subscriptions/types/subscriptions";
import {
  eventLabel,
  statusLabel,
  subscriptionRoiPct,
} from "../subscriptions-constants";

export function SubscriptionDetailView({
  subscription,
}: {
  subscription: SubscriptionDetail;
}) {
  const t = useTranslations("subscriptions");
  const locale = useLocale();
  const roi = subscriptionRoiPct(subscription);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-panel-strong p-3 sm:p-4">
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
            {t("detail.statLabels.status")}
          </p>
          <Badge className="mt-1" variant="secondary">
            {statusLabel(subscription.status, t)}
          </Badge>
        </div>
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

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("detail.history")}
        </p>
        {subscription.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("detail.historyEmpty")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {subscription.events.map((event) => (
              <div
                key={event.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words leading-snug text-foreground">
                    {eventLabel(event, t, locale)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {event.kickoff ? formatDateTime(event.kickoff) : event.date}
                    {event.odds
                      ? ` · ${t("detail.odds", { value: Number(event.odds).toFixed(2) })}`
                      : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {event.result ? (
                    <>
                      <Badge
                        variant={
                          event.result === "WON" ? "default" : "secondary"
                        }
                      >
                        {t(`detail.results.${event.result}`)}
                      </Badge>
                      <p
                        className={`mt-1 text-xs font-medium ${
                          Number(event.pnl ?? 0) >= 0
                            ? "text-success"
                            : "text-destructive"
                        }`}
                      >
                        <Amount value={event.pnl ?? "0"} signed />
                      </p>
                    </>
                  ) : (
                    <Badge variant="outline">{t("detail.pending")}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
