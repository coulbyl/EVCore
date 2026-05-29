"use client";

import Image from "next/image";
import { Check, ShoppingCart } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  ProgressBar,
  Separator,
  cn,
} from "@evcore/ui";
import { useBetSlip } from "@/domains/bet-slip/context/bet-slip-context";
import { draftItemKey } from "@/domains/bet-slip/types/bet-slip";
import { translateCountry, translateCompetition } from "@/lib/competition-i18n";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import type { InvestmentCouponDto } from "@/domains/ai-engine/types/investment";
import { CANAL_COLOR, formatPct } from "./canal-constants";
import { ResultBadge } from "./result-badge";

export function CouponCard({
  coupon,
  locale,
  isTop,
}: {
  coupon: InvestmentCouponDto;
  locale: string;
  isTop: boolean;
}) {
  const { clearDraft, addItem, setType, isInSlip, open } = useBetSlip();
  const loc = locale === "en" ? "en" : "fr";
  const probPct = coupon.jointProbability * 100;

  const isSettled = coupon.legs.some((l) => l.isCorrect !== null);
  const allInSlip = coupon.legs.every((l) =>
    isInSlip(
      draftItemKey({ fixtureId: l.fixtureId, market: l.market, pick: l.pick }),
    ),
  );

  function handlePlayCombo() {
    clearDraft();
    for (const leg of coupon.legs) {
      addItem({
        fixtureId: leg.fixtureId,
        fixture: `${leg.homeTeam} vs ${leg.awayTeam}`,
        homeLogo: leg.homeLogo,
        awayLogo: leg.awayLogo,
        competition: leg.competition,
        scheduledAt: leg.scheduledAt,
        market: leg.market,
        pick: leg.pick,
        odds: leg.oddsSnapshot != null ? leg.oddsSnapshot.toFixed(2) : null,
        ev: null,
        stakeOverride: null,
        ...(leg.betId
          ? { betId: leg.betId }
          : { modelRunId: leg.modelRunId ?? undefined }),
      });
    }
    setType("COMBO");
    open();
  }

  const probColor =
    probPct >= 40
      ? "text-emerald-500"
      : probPct >= 30
        ? "text-amber-500"
        : "text-muted-foreground";

  return (
    <Card
      className={cn(
        "gap-4 rounded-[1.45rem] py-5",
        isTop
          ? "border-primary/30 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] shadow-sm"
          : "border-amber-500/30",
      )}
    >
      <CardHeader className="gap-3 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {isTop && (
                <Badge
                  variant="accent"
                  className="rounded-full uppercase tracking-[0.16em]"
                >
                  Meilleur
                </Badge>
              )}
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Coupon #{coupon.rank}
              </span>
            </div>
            <CardDescription className="text-sm">
              {coupon.legs.length} sélections combinées pour une cote totale de{" "}
              <span className="font-mono font-semibold text-foreground">
                @{coupon.combinedOdds.toFixed(2)}
              </span>
            </CardDescription>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/30 px-3 py-2 text-right">
            <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
              Proba
            </p>
            <p className={cn("text-sm font-semibold", probColor)}>
              {formatPct(coupon.jointProbability)}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 px-5">
        <ProgressBar
          value={Math.round(probPct)}
          max={100}
          thresholds={{ success: 40, warning: 25 }}
          showValue={false}
        />

        <Separator />

        <div className="flex flex-col gap-3">
          {coupon.legs.map((leg) => {
            const color = CANAL_COLOR[leg.canal];
            const marketLabel = formatMarketForDisplay(leg.market, loc);
            const pickLabel = formatPickForDisplay(leg.pick, leg.market);

            return (
              <div
                key={`${leg.fixtureId}:${leg.canal}`}
                className="rounded-xl border border-border/60 bg-background/20 p-3"
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 size-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-sm font-medium">
                        {leg.homeLogo && (
                          <Image
                            src={leg.homeLogo}
                            alt={leg.homeTeam}
                            width={14}
                            height={14}
                            className="size-3.5 shrink-0 object-contain"
                          />
                        )}
                        <span className="truncate">{leg.homeTeam}</span>
                        <span className="font-normal text-muted-foreground">–</span>
                        {leg.awayLogo && (
                          <Image
                            src={leg.awayLogo}
                            alt={leg.awayTeam}
                            width={14}
                            height={14}
                            className="size-3.5 shrink-0 object-contain"
                          />
                        )}
                        <span className="truncate">{leg.awayTeam}</span>
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <ResultBadge isCorrect={leg.isCorrect} />
                        {leg.oddsSnapshot != null && (
                          <span className="font-mono text-xs text-muted-foreground">
                            @{leg.oddsSnapshot.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className="font-mono uppercase tracking-widest"
                        style={{ color }}
                      >
                        {leg.canal}
                      </span>
                      <span>·</span>
                      <span className="uppercase tracking-widest text-[0.6rem]">
                        {translateCountry(leg.country, locale)} · {translateCompetition(leg.competition, locale)}
                      </span>
                      <span>·</span>
                      <span>
                        {marketLabel} · {pickLabel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {coupon.reasoning && (
          <p className="rounded-xl border border-dashed border-border/70 bg-background/20 px-3 py-2 text-xs leading-snug text-muted-foreground">
            {coupon.reasoning}
          </p>
        )}

        {!isSettled && (
          <button
            type="button"
            onClick={handlePlayCombo}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl border py-2 text-xs font-semibold transition-colors",
              allInSlip
                ? "border-success/20 bg-success/12 text-success"
                : "border-border bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {allInSlip ? (
              <>
                <Check size={12} /> Dans le coupon
              </>
            ) : (
              <>
                <ShoppingCart size={12} /> Jouer ce coupon
              </>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
