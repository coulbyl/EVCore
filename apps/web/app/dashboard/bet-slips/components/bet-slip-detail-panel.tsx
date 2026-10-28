"use client";

import { X } from "lucide-react";
import { Badge } from "@evcore/ui";
import { useLocale, useTranslations } from "next-intl";
import { formatMarketForDisplay } from "@/helpers/fixture";
import { formatDateLong } from "@/lib/date";
import { formatOddsValue } from "@/lib/frequency";
import { useCurrencyFormat } from "@/providers/currency-provider";
import { ResultBadge } from "@/components/result-badge";
import { DeleteSlipDialog } from "./delete-slip-dialog";
import type {
  BetSlipItemView,
  BetSlipView,
} from "@/domains/bet-slip/types/bet-slip";
import {
  SLIP_STATUS_VARIANT,
  legMatchLabel,
  legPickLabel,
} from "./bet-slip-constants";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

type MatchGroup = { fixtureId: string; items: BetSlipItemView[] };

function groupByFixture(items: BetSlipItemView[]): MatchGroup[] {
  const groups = new Map<string, MatchGroup>();
  for (const item of items) {
    const group = groups.get(item.fixtureId) ?? {
      fixtureId: item.fixtureId,
      items: [],
    };
    group.items.push(item);
    groups.set(item.fixtureId, group);
  }
  return [...groups.values()];
}

/** Ce qu'une jambe d'un pari simple a rendu ou peut rendre. */
function LegMoney({ item }: { item: BetSlipItemView }) {
  const t = useTranslations("betSlips");
  const { formatAmount, formatSigned } = useCurrencyFormat();
  const stake = Number(item.stake);
  const odds = item.odds === null ? null : Number(item.odds);
  let outcome: string | null = null;
  if (item.betStatus === "WON" && odds !== null) {
    outcome = formatSigned(stake * (odds - 1));
  } else if (item.betStatus === "LOST") {
    outcome = formatSigned(-stake);
  } else if (item.betStatus === "VOID") {
    outcome = t("legRefunded");
  } else if (odds !== null) {
    outcome = t("legPotential", { amount: formatAmount(stake * odds) });
  }
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {t("legStake", { amount: formatAmount(stake) })}
      {outcome ? (
        <span className="font-semibold tabular-nums text-foreground">
          {" "}
          · {outcome}
        </span>
      ) : null}
    </p>
  );
}

function MatchGroupCard({
  group,
  slipType,
}: {
  group: MatchGroup;
  slipType: BetSlipView["type"];
}) {
  const locale = useLocale();
  const first = group.items[0];
  if (!first) return null;

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-semibold text-muted-foreground">
          {legMatchLabel(first)}
        </p>
        {first.homeScore !== null && first.awayScore !== null ? (
          <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
            {first.homeScore} – {first.awayScore}
          </span>
        ) : null}
      </div>
      <ul className="mt-1.5 flex flex-col gap-2">
        {group.items.map((item) => (
          <li key={item.betId}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {legPickLabel(item)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatMarketForDisplay(item.market)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {item.odds ? (
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {formatOddsValue(Number(item.odds), locale)}
                  </span>
                ) : null}
                <ResultBadge result={item.betStatus} />
              </div>
            </div>
            {slipType === "SIMPLE" ? <LegMoney item={item} /> : null}
          </li>
        ))}
      </ul>
    </li>
  );
}

export function BetSlipDetailPanel({
  data,
  onClose,
}: {
  data: BetSlipView;
  onClose: () => void;
}) {
  const t = useTranslations("betSlips");
  const locale = useLocale();
  const { formatAmount, formatSigned } = useCurrencyFormat();
  const { result } = data;
  const pending = result.status === "PENDING";
  const comboWithRefund =
    data.type === "COMBO" && data.items.some((i) => i.betStatus === "VOID");

  return (
    <div
      data-testid="bet-slip-detail"
      className="flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-border bg-panel-strong ev-shell-shadow"
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">
            {data.type === "COMBO"
              ? t("kindCombo", { count: data.itemCount })
              : t("kindSingle", { count: data.itemCount })}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("playedOn", { date: formatDateLong(data.createdAt) })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge
            variant={SLIP_STATUS_VARIANT[result.status]}
            className="text-xs"
          >
            {t(`status.${result.status}`)}
          </Badge>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="flex size-11 items-center justify-center rounded-xl border border-border bg-panel text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <dl className="flex flex-col gap-2.5 border-b border-border px-4 py-4">
          <DetailRow label={t("staked")} value={formatAmount(result.staked)} />
          {data.totalOdds ? (
            <DetailRow
              label={t("odds")}
              value={formatOddsValue(Number(data.totalOdds), locale)}
            />
          ) : null}
          {Number(result.settledStake) > 0 ? (
            <>
              <DetailRow
                label={t("returned")}
                value={formatAmount(result.returned)}
              />
              <DetailRow
                label={pending ? t("partialNet") : t("net")}
                value={formatSigned(result.net)}
              />
            </>
          ) : null}
          {pending ? (
            <p className="text-xs leading-5 text-muted-foreground">
              {t("potential", {
                amount: formatAmount(result.potentialReturn),
                gain: formatAmount(
                  Math.max(
                    0,
                    Number(result.potentialReturn) -
                      Number(result.pendingStake),
                  ),
                ),
              })}
            </p>
          ) : null}
          {comboWithRefund ? (
            <p className="text-xs leading-5 text-muted-foreground">
              {t("refundRule")}
            </p>
          ) : null}
        </dl>

        <ul className="flex flex-col divide-y divide-border px-4 py-4">
          {groupByFixture(data.items).map((group) => (
            <MatchGroupCard
              key={group.fixtureId}
              group={group}
              slipType={data.type}
            />
          ))}
        </ul>

        {data.deletable ? (
          <div className="border-t border-border px-4 py-4">
            <DeleteSlipDialog
              slipId={data.id}
              staked={result.staked}
              onDeleted={onClose}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
