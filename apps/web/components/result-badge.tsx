import { Badge } from "@evcore/ui";
import { useTranslations } from "next-intl";

export type ResultValue = "PENDING" | "WON" | "LOST" | "VOID";

const RESULT_META: Record<
  Exclude<ResultValue, "PENDING">,
  {
    labelKey: "won" | "lost" | "void";
    variant: "success" | "destructive" | "neutral";
  }
> = {
  WON: { labelKey: "won", variant: "success" },
  LOST: { labelKey: "lost", variant: "destructive" },
  VOID: { labelKey: "void", variant: "neutral" },
};

/** Shared pick-result badge: shows nothing while pending, and — once a
 * fixture is finished but the pick has no result yet — an optional
 * "Terminé" fallback. */
export function ResultBadge({
  result,
  finished = false,
}: {
  result: ResultValue | null;
  finished?: boolean;
}) {
  const t = useTranslations("resultBadge");
  if (result === null || result === "PENDING") {
    return finished ? (
      <Badge variant="outline" className="text-xs">
        {t("settlementPending")}
      </Badge>
    ) : null;
  }
  const meta = RESULT_META[result];
  // Toute jambe rendue se lit « Remboursé », match reporté comme nul sur un
  // Draw No Bet : pour le joueur, la mise revient dans les deux cas
  // (PRODUCT.md, vocabulaire ; « Annulé » sous un coupon « Remboursé »
  // relevé par la revue UX du 2026-10-27).
  const label = result === "VOID" ? t("refunded") : t(meta.labelKey);
  return (
    <Badge variant={meta.variant} className="text-xs">
      {label}
    </Badge>
  );
}
