"use client";

import { useTranslations } from "next-intl";
import { Badge, cn } from "@evcore/ui";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import { AddToCouponButton } from "@/components/add-to-coupon-button";
import { CanalBadge } from "@/components/canal-badge";
import { ResultBadge } from "@/components/result-badge";
import type { BetSlipDraftItem } from "@/domains/bet-slip/types/bet-slip";
import type { InvestmentPick } from "@/domains/investment/types/investment";
import { LegConnector } from "@/components/leg-connector";
import { formatEv, formatPct } from "./investment-constants";

export function InvestmentPickRow({
  pick,
  locale,
  connector,
  isLast,
}: {
  pick: InvestmentPick;
  locale: string;
  connector: boolean;
  isLast: boolean;
}) {
  const t = useTranslations("investment");
  const loc = locale === "en" ? "en" : "fr";

  const slipItem: BetSlipDraftItem = {
    fixtureId: pick.fixtureId,
    fixture: pick.fixture,
    homeLogo: pick.homeLogo,
    awayLogo: pick.awayLogo,
    competition: pick.competition ?? "",
    scheduledAt: pick.scheduledAt,
    market: pick.market,
    pick: pick.pick,
    odds: String(pick.odds),
    comboMarket: pick.comboMarket ?? undefined,
    comboPick: pick.comboPick ?? undefined,
    ev: pick.ev === null ? null : String(pick.ev),
    canal: pick.channel,
    stakeOverride: null,
  };

  const ev = formatEv(pick.ev);

  return (
    <div className="flex py-2">
      {connector && <LegConnector isLast={isLast} />}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-bold text-foreground">
            {formatPickForDisplay(pick.pick, pick.market)}
          </span>
          <CanalBadge canal={pick.channel} />
          <span className="text-[0.68rem] text-muted-foreground">
            {formatMarketForDisplay(pick.market, loc)}
          </span>
          <span className="ml-auto text-sm font-bold tabular-nums text-foreground">
            {pick.odds.toFixed(2)}
          </span>
          <span className="text-[0.68rem] tabular-nums text-muted-foreground">
            {formatPct(pick.probability)}
            {Math.abs(pick.modelProbability - pick.probability) >= 0.02 && (
              <span className="ml-1 opacity-60">
                ({t("modelProbability")} {formatPct(pick.modelProbability)})
              </span>
            )}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[0.62rem]">
            {t(`bucket.${pick.probabilityBucket}`)}
          </Badge>
          {ev !== null && (
            <Badge
              variant="outline"
              className={cn(
                "text-[0.62rem]",
                pick.evSign === "negative"
                  ? "border-destructive/30 text-destructive"
                  : "border-success/30 text-success",
              )}
            >
              {ev}
            </Badge>
          )}
          {pick.shortOdds && (
            <Badge variant="outline" className="text-[0.62rem] text-warning">
              {t("badge.shortOdds")}
            </Badge>
          )}
          {pick.channelRoiFlag && (
            <Badge variant="outline" className="text-[0.62rem] text-warning">
              {t("badge.channelRoiFlag")}
            </Badge>
          )}
          <ResultBadge result={pick.result} finished={pick.score !== null} />
          {pick.score === null && (
            <span className="ml-auto">
              <AddToCouponButton item={slipItem} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
