import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@evcore/ui";
import { useCurrencyFormat } from "@/providers/currency-provider";
import type { Subscription } from "@/domains/subscriptions/types/subscriptions";
import { SubscriptionSourceHeader } from "./subscription-source-badge";
import {
  formatDayConditions,
  statusLabel,
  subscriptionHitRatePct,
  subscriptionRoiPct,
} from "../subscriptions-constants";

export function SubscriptionCard({
  subscription,
}: {
  subscription: Subscription;
}) {
  const t = useTranslations("subscriptions");
  const { formatAmount } = useCurrencyFormat();
  const roi = subscriptionRoiPct(subscription);
  const hitRate = subscriptionHitRatePct(subscription);

  return (
    <Link
      href={`/dashboard/subscriptions/${subscription.id}`}
      className="flex w-full flex-col gap-3 rounded-[1.15rem] border border-border bg-panel-strong px-4 py-4 text-left shadow-sm transition hover:border-accent/50 sm:rounded-[1.55rem] sm:px-5 sm:py-5"
    >
      <div className="flex items-start justify-between gap-3">
        <SubscriptionSourceHeader subscription={subscription} />
        <Badge
          variant={subscription.status === "ACTIVE" ? "default" : "secondary"}
        >
          {statusLabel(subscription.status, t)}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-border pt-3">
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
            {t("card.stakePerEvent")}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {formatAmount(subscription.stakePerEvent)}
          </p>
        </div>
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
            {t("card.roiCumulative")}
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
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
            {t("card.hitRate")}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {hitRate === null ? "—" : `${hitRate.toFixed(0)}%`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{formatDayConditions(subscription, t)}</span>
        <span>
          {subscription.startDate} → {subscription.endDate}
        </span>
      </div>

      <div className="text-xs text-muted-foreground">
        {t("card.eventsSettled", {
          settled: subscription.settledEvents,
          total: subscription.totalEvents,
          staked: formatAmount(subscription.totalStaked),
        })}
      </div>
    </Link>
  );
}
