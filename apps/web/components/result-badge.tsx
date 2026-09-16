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

// DRAW_NO_BET's VOID is a stake refund on a drawn match, not a genuine
// cancellation (postponed fixture, etc.) — same BetStatus.VOID value in the
// data model (no distinct "refunded" status), so the distinction has to be
// made here from market context rather than the result value alone.
const REFUND_MARKETS = new Set(["DRAW_NO_BET"]);

/** Shared pick-result badge: shows nothing while pending, and — once a
 * fixture is finished but the pick has no result yet — an optional
 * "Terminé" fallback. */
export function ResultBadge({
  result,
  finished = false,
  market,
}: {
  result: ResultValue | null;
  finished?: boolean;
  market?: string;
}) {
  const t = useTranslations("resultBadge");
  if (result === null || result === "PENDING") {
    return finished ? (
      <Badge variant="outline" className="text-[0.62rem]">
        {t("settlementPending")}
      </Badge>
    ) : null;
  }
  const meta = RESULT_META[result];
  const label =
    result === "VOID" && market !== undefined && REFUND_MARKETS.has(market)
      ? t("refunded")
      : t(meta.labelKey);
  return (
    <Badge variant={meta.variant} className="text-[0.62rem]">
      {label}
    </Badge>
  );
}
