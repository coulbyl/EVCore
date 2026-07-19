import { Eye } from "lucide-react";
import { Badge } from "@evcore/ui";
import { useTranslations } from "next-intl";

// Observation-only channels (CORRECT_SCORE, CLEAN_SHEET, TEAM_TOTAL,
// WIN_EITHER_HALF) are never staked — their picks are recorded and settled
// analytically only. This badge keeps readers from mistaking them for
// playable bets.
export function ObservationBadge() {
  const t = useTranslations("decisions");
  return (
    <Badge
      variant="outline"
      className="gap-1 text-[0.62rem] text-muted-foreground"
      title={t("observation.tooltip")}
    >
      <Eye className="size-2.5" />
      {t("observation.badge")}
    </Badge>
  );
}
