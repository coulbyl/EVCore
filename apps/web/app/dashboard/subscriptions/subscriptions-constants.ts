import type { useTranslations } from "next-intl";
import type {
  Subscription,
  SubscriptionChannelPickMode,
  SubscriptionSourceType,
} from "@/domains/subscriptions/types/subscriptions";

type Translator = ReturnType<typeof useTranslations>;

export function statusLabel(status: Subscription["status"], t: Translator) {
  return t(`status.${status}`);
}

export function sourceLabel(sourceType: SubscriptionSourceType, t: Translator) {
  return t(`sources.${sourceType}`);
}

export function pickModeLabel(mode: string, t: Translator) {
  return t(`pickModes.${mode}`);
}

export function pickModeShortLabel(
  mode: SubscriptionChannelPickMode,
  t: Translator,
) {
  return t(`pickModeShort.${mode}`);
}

export function weekdayFullLabel(value: number, t: Translator) {
  return t(`weekdayFull.${value}`);
}

export function weekdayShortLabel(value: number, t: Translator) {
  return t(`weekdayShort.${value}`);
}

export function leaguePresetLabel(presetId: string, t: Translator) {
  return t(`leaguePresets.${presetId}`);
}

// roiPct est déjà calculé côté backend (SubscriptionsService) — évite de
// dupliquer la logique d'arrondi/division ici.
export function subscriptionRoiPct(sub: Subscription): number | null {
  return sub.roiPct === null ? null : Number(sub.roiPct);
}

export function subscriptionHitRatePct(sub: Subscription): number | null {
  if (sub.settledEvents <= 0) return null;
  return (sub.wonEvents / sub.settledEvents) * 100;
}

export function formatDayConditions(sub: Subscription, t: Translator): string {
  const parts: string[] = [];
  if (sub.daysOfWeek.length === 7) {
    parts.push(t("dayConditions.allDays"));
  } else if (sub.daysOfWeek.length > 0) {
    parts.push(
      [...sub.daysOfWeek]
        .sort((a, b) => a - b)
        .map((d) => weekdayShortLabel(d, t))
        .join(", "),
    );
  }
  if (sub.competitionCodes.length > 0) {
    parts.push(
      t("dayConditions.competitions", { count: sub.competitionCodes.length }),
    );
  }
  return parts.length > 0 ? parts.join(" · ") : t("dayConditions.none");
}
