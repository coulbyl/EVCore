import { Eye } from "lucide-react";
import { Badge } from "@evcore/ui";
import { useTranslations } from "next-intl";

// CORRECT_SCORE is a prediction channel (most-likely scoreline), never staked.
// This badge keeps readers from mistaking its picks for playable bets.
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
