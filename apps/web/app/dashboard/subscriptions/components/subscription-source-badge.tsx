import { useTranslations } from "next-intl";
import { Badge } from "@evcore/ui";
import { Ticket } from "lucide-react";
import { CanalBadge } from "@/components/canal-badge";
import type { Subscription } from "@/domains/subscriptions/types/subscriptions";
import type { SubscriptionSourceType } from "@/domains/subscriptions/types/subscriptions";
import { pickModeShortLabel, sourceLabel } from "../subscriptions-constants";

export const SUBSCRIPTION_CHANNEL_BY_SOURCE: Partial<
  Record<SubscriptionSourceType, Parameters<typeof CanalBadge>[0]["canal"]>
> = {
  CHANNEL_VALUE: "VALUE",
  CHANNEL_SAFE: "SAFE",
  CHANNEL_DOMINANT: "DOMINANT",
  CHANNEL_DRAW: "DRAW",
  CHANNEL_BTTS: "BTTS",
  CHANNEL_TEAM_TOTAL: "TEAM_TOTAL",
};

// CanalBadge pour une source CHANNEL_*, badge "ticket" pour une source
// Coupon (COUPON_BEST/COUPON_ALL, pas de canal associé) — même présentation
// sur la card et le détail d'abonnement.
export function SubscriptionSourceBadge({
  sourceType,
}: {
  sourceType: SubscriptionSourceType;
}) {
  const t = useTranslations("subscriptions");
  const channel = SUBSCRIPTION_CHANNEL_BY_SOURCE[sourceType];

  if (channel) {
    return <CanalBadge canal={channel} />;
  }
  return (
    <Badge variant="secondary" className="gap-1.5">
      <Ticket size={12} />
      {sourceLabel(sourceType, t)}
    </Badge>
  );
}

// Ligne "badge source + mode de sélection" — identique sur la card
// (subscription-card.tsx) et l'en-tête du détail, une seule source de vérité
// pour cette présentation.
export function SubscriptionSourceHeader({
  subscription,
}: {
  subscription: Pick<Subscription, "sourceType" | "channelPickMode" | "topN">;
}) {
  const t = useTranslations("subscriptions");

  return (
    <div className="flex items-center gap-2">
      <SubscriptionSourceBadge sourceType={subscription.sourceType} />
      {subscription.channelPickMode ? (
        <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
          {pickModeShortLabel(subscription.channelPickMode, t)}
          {subscription.topN ? ` · ${t("topN", { n: subscription.topN })}` : ""}
        </span>
      ) : null}
    </div>
  );
}
