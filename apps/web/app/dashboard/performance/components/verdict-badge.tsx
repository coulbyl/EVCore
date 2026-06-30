import { Badge } from "@evcore/ui";
import { useTranslations } from "next-intl";
import type { BacktestVerdict } from "@/domains/backtest/types/channel-backtest";
import { verdictToneClass } from "./analysis-constants";

export function VerdictBadge({ verdict }: { verdict: BacktestVerdict }) {
  const t = useTranslations("performancePage");
  return (
    <Badge
      variant="outline"
      className={`text-[0.62rem] ${verdictToneClass(verdict)}`}
    >
      {t(`verdict.${verdict}`)}
    </Badge>
  );
}
