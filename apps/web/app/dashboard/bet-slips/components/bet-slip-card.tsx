"use client";

import { Badge, cn } from "@evcore/ui";
import { useLocale, useTranslations } from "next-intl";
import { formatDateLong } from "@/lib/date";
import { formatOddsValue } from "@/lib/frequency";
import { useCurrencyFormat } from "@/providers/currency-provider";
import type { BetSlipView } from "@/domains/bet-slip/types/bet-slip";
import {
  SLIP_STATUS_VARIANT,
  legMatchLabel,
  legPickLabel,
} from "./bet-slip-constants";

const VISIBLE_LEGS = 2;

/**
 * Un coupon joué : ce qui a été parié (avec les équipes), combien, et ce
 * que ça a rendu. Les montants sont en couleur neutre : le statut porte la
 * couleur, un « rendu » en vert se lisait comme un gain (revue UX du
 * 2026-10-27, P1-4).
 */
export function BetSlipCard({
  betSlip,
  selected,
  onClick,
}: {
  betSlip: BetSlipView;
  selected: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("betSlips");
  const locale = useLocale();
  const { formatAmount, formatSigned } = useCurrencyFormat();
  const { result } = betSlip;
  const pending = result.status === "PENDING";
  const hiddenLegs = betSlip.items.length - VISIBLE_LEGS;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      data-testid="bet-slip-card"
      className={cn(
        "w-full cursor-pointer rounded-2xl border p-4 text-left transition-colors",
        selected
          ? "border-accent bg-accent/5"
          : "border-border bg-panel hover:bg-secondary",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">
            {betSlip.type === "COMBO"
              ? t("kindCombo", { count: betSlip.itemCount })
              : t("kindSingle", { count: betSlip.itemCount })}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("playedOn", { date: formatDateLong(betSlip.createdAt) })}
          </p>
        </div>
        <Badge
          variant={SLIP_STATUS_VARIANT[result.status]}
          className="shrink-0 text-xs"
        >
          {t(`status.${result.status}`)}
        </Badge>
      </div>

      <ul className="mt-3 flex flex-col gap-1">
        {betSlip.items.slice(0, VISIBLE_LEGS).map((item) => (
          <li key={item.betId} className="min-w-0 text-sm">
            <span className="font-medium text-foreground">
              {legPickLabel(item)}
            </span>
            <span className="text-muted-foreground">
              {" "}
              · {legMatchLabel(item)}
            </span>
          </li>
        ))}
        {hiddenLegs > 0 ? (
          <li className="text-xs text-muted-foreground">
            {t("moreLegs", { count: hiddenLegs })}
          </li>
        ) : null}
      </ul>

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2.5 text-sm">
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">{t("staked")}</dt>
          <dd className="font-semibold tabular-nums text-foreground">
            {formatAmount(result.staked)}
          </dd>
        </div>
        {betSlip.totalOdds ? (
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">{t("odds")}</dt>
            <dd className="font-semibold tabular-nums text-foreground">
              {formatOddsValue(Number(betSlip.totalOdds), locale)}
            </dd>
          </div>
        ) : null}
        {Number(result.settledStake) > 0 ? (
          <>
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">{t("returned")}</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {formatAmount(result.returned)}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">
                {pending ? t("partialNet") : t("net")}
              </dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {formatSigned(result.net)}
              </dd>
            </div>
          </>
        ) : null}
      </dl>
      {pending ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("potential", {
            amount: formatAmount(result.potentialReturn),
            gain: formatAmount(
              Math.max(
                0,
                Number(result.potentialReturn) - Number(result.pendingStake),
              ),
            ),
          })}
        </p>
      ) : null}
    </button>
  );
}
