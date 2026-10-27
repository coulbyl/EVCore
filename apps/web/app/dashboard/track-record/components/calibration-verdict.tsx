"use client";

import { Badge } from "@evcore/ui";
import { useTranslations } from "next-intl";
import type { ChannelStatus } from "@/domains/dashboard/types/dashboard";

type VerdictKey =
  | "conform"
  | "slightlyOptimistic"
  | "optimistic"
  | "slightlyCautious"
  | "cautious"
  | "insufficient"
  | "inactive";

const VERDICT_VARIANT: Record<
  VerdictKey,
  "success" | "warning" | "destructive" | "neutral" | "outline"
> = {
  conform: "success",
  slightlyOptimistic: "warning",
  optimistic: "destructive",
  slightlyCautious: "neutral",
  cautious: "warning",
  insufficient: "outline",
  inactive: "neutral",
};

/**
 * Le statut de calibration en mots, avec son sens.
 *
 * L'ancien badge disait « Écart 15–30 % » : un écart relatif que le joueur
 * prenait pour des points (34 % − 29 % = 5 points, « le badge est faux »), et
 * qui donnait le même libellé à 0,84 (trop optimiste) et à 1,16 (trop
 * prudent). Le sens compte : un pourcentage trop optimiste fait perdre, un
 * pourcentage trop prudent non (audit UX du 2026-10-27).
 */
export function verdictKey(
  status: ChannelStatus,
  ratio: number | null,
): VerdictKey {
  if (status === "INSUFFICIENT_DATA") return "insufficient";
  if (status === "INACTIVE" || ratio === null) return "inactive";
  if (status === "GREEN") return "conform";
  const optimistic = ratio < 1;
  if (status === "ORANGE")
    return optimistic ? "slightlyOptimistic" : "slightlyCautious";
  return optimistic ? "optimistic" : "cautious";
}

export function CalibrationVerdict({
  status,
  ratio,
  className,
}: {
  status: ChannelStatus;
  /** Réalisé ÷ annoncé ; sous 1, les pourcentages étaient trop optimistes. */
  ratio: number | null;
  className?: string;
}) {
  const t = useTranslations("calibrationVerdict");
  const key = verdictKey(status, ratio);
  return (
    <Badge variant={VERDICT_VARIANT[key]} className={className}>
      {t(key)}
    </Badge>
  );
}
