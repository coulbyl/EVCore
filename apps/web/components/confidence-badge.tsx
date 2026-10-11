"use client";

import { useTranslations } from "next-intl";
import { cn } from "@evcore/ui";
import type { ChannelStatus } from "@/domains/dashboard/types/dashboard";

const TONE: Partial<Record<ChannelStatus, string>> = {
  GREEN: "bg-emerald-500",
  ORANGE: "bg-amber-500",
  RED: "bg-destructive",
};

/**
 * Un seul indicateur de confiance par sélection, en un mot : « fiable »,
 * « à surveiller », « peu fiable ». Il traduit l'écart mesuré entre réussite
 * réelle et probabilité annoncée du canal sur 90 jours (ChannelStatus), sans
 * jamais afficher le pourcentage d'écart lui-même — c'est un jargon de
 * calibration que l'écran Décisions répétait sous chaque pick (revue UX du
 * 2026-10-11, P1-7). Rien tant que le volume est insuffisant.
 */
export function ConfidenceBadge({
  status,
  className,
}: {
  status: ChannelStatus | undefined;
  className?: string;
}) {
  const t = useTranslations("confidence");
  if (status !== "GREEN" && status !== "ORANGE" && status !== "RED") {
    return null;
  }
  const label =
    status === "GREEN"
      ? t("reliable")
      : status === "ORANGE"
        ? t("watch")
        : t("unreliable");
  return (
    <span
      data-testid="confidence-badge"
      title={t("hint")}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2 py-0.5 text-[0.62rem] font-medium text-muted-foreground",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", TONE[status])} />
      {label}
    </span>
  );
}
