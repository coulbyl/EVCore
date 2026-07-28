import { Badge } from "@evcore/ui";
import { Ticket } from "lucide-react";
import { CanalBadge } from "@/components/canal-badge";
import { useCurrencyFormat } from "@/providers/currency-provider";
import type { Subscription } from "@/domains/subscriptions/types/subscriptions";
import {
  STATUS_LABEL,
  formatDayConditions,
  subscriptionHitRatePct,
  subscriptionRoiPct,
} from "../subscriptions-constants";

const CHANNEL_BY_SOURCE: Partial<
  Record<Subscription["sourceType"], Parameters<typeof CanalBadge>[0]["canal"]>
> = {
  CHANNEL_VALUE: "VALUE",
  CHANNEL_SAFE: "SAFE",
  CHANNEL_DOMINANT: "DOMINANT",
  CHANNEL_DRAW: "DRAW",
  CHANNEL_BTTS: "BTTS",
  CHANNEL_TEAM_TOTAL: "TEAM_TOTAL",
};

export function SubscriptionCard({
  subscription,
  onClick,
}: {
  subscription: Subscription;
  onClick?: () => void;
}) {
  const { formatAmount } = useCurrencyFormat();
  const roi = subscriptionRoiPct(subscription);
  const hitRate = subscriptionHitRatePct(subscription);
  const channel = CHANNEL_BY_SOURCE[subscription.sourceType];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      }}
      className="flex w-full cursor-pointer flex-col gap-3 rounded-[1.15rem] border border-border bg-panel-strong px-4 py-4 text-left shadow-sm transition hover:border-accent/50 sm:rounded-[1.55rem] sm:px-5 sm:py-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {channel ? (
            <CanalBadge canal={channel} />
          ) : (
            <Badge variant="secondary" className="gap-1.5">
              <Ticket size={12} />
              {subscription.sourceLabel}
            </Badge>
          )}
          {subscription.channelPickMode ? (
            <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              {subscription.channelPickMode === "INVESTIR"
                ? "Investir"
                : "Decisions"}
              {subscription.topN ? ` · Top ${subscription.topN}` : ""}
            </span>
          ) : null}
        </div>
        <Badge
          variant={subscription.status === "ACTIVE" ? "default" : "secondary"}
        >
          {STATUS_LABEL[subscription.status]}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-border pt-3">
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
            Mise / événement
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {formatAmount(subscription.stakePerEvent)}
          </p>
        </div>
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
            ROI cumulé
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
            Taux de réussite
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {hitRate === null ? "—" : `${hitRate.toFixed(0)}%`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{formatDayConditions(subscription)}</span>
        <span>
          {subscription.startDate} → {subscription.endDate}
        </span>
      </div>

      <div className="text-xs text-muted-foreground">
        {subscription.settledEvents}/{subscription.totalEvents} événement(s)
        réglé(s) · {formatAmount(subscription.totalStaked)} misé au total
      </div>
    </div>
  );
}
