import type {
  Subscription,
  SubscriptionStatus,
} from "@/domains/subscriptions/types/subscriptions";

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: "Actif",
  ENDED: "Terminé",
  CANCELLED: "Annulé",
};

export const STATUS_TONE: Record<
  SubscriptionStatus,
  "accent" | "success" | "neutral"
> = {
  ACTIVE: "accent",
  ENDED: "neutral",
  CANCELLED: "neutral",
};

// roiPct est déjà calculé côté backend (SubscriptionsService) — évite de
// dupliquer la logique d'arrondi/division ici.
export function subscriptionRoiPct(sub: Subscription): number | null {
  return sub.roiPct === null ? null : Number(sub.roiPct);
}

export function subscriptionHitRatePct(sub: Subscription): number | null {
  if (sub.settledEvents <= 0) return null;
  return (sub.wonEvents / sub.settledEvents) * 100;
}

export function formatDayConditions(sub: Subscription): string {
  const parts: string[] = [];
  if (sub.daysOfWeek.length === 7) {
    parts.push("Tous les jours");
  } else if (sub.daysOfWeek.length > 0) {
    const labels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    parts.push(
      [...sub.daysOfWeek]
        .sort((a, b) => a - b)
        .map((d) => labels[d])
        .join(", "),
    );
  }
  if (sub.competitionCodes.length > 0) {
    parts.push(`${sub.competitionCodes.length} championnat(s)`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Aucune condition";
}
