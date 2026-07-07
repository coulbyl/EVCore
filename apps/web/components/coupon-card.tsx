"use client";

import { Check, ShoppingCart } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  ProgressBar,
  cn,
} from "@evcore/ui";
import { CanalBadge } from "@/components/canal-badge";
import { FixtureCard } from "@/components/fixture-card";
import { ResultBadge, type ResultValue } from "@/components/result-badge";

export type NormalizedCouponLeg = {
  key: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  country: string | null;
  competition: string | null;
  kickoff: string;
  score: string | null;
  htScore: string | null;
  canal: "VALUE" | "SAFE" | "DOMINANT" | "DRAW" | "BTTS" | "GOALS";
  marketLabel: string;
  pickLabel: string;
  probability: number;
  odds: string | null;
  result: ResultValue | null;
};

export type CouponCardProps = {
  locale: string;
  rank: number;
  combinedOdds: number;
  jointProbability: number;
  signalScore: number;
  reasoning?: string | null;
  isTop?: boolean;
  betStatus?: "WON" | "LOST" | null;
  legs: NormalizedCouponLeg[];
  actionSlot?: React.ReactNode;
};

function formatPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

export function CouponCard({
  locale,
  rank,
  combinedOdds,
  jointProbability,
  reasoning,
  isTop = false,
  betStatus,
  legs,
  actionSlot,
}: CouponCardProps) {
  const probPct = jointProbability * 100;
  const probColor =
    probPct >= 40
      ? "text-emerald-500"
      : probPct >= 30
        ? "text-amber-500"
        : "text-muted-foreground";

  return (
    <Card
      className={cn(
        "gap-3 rounded-2xl py-3",
        isTop
          ? "border-primary/30 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] shadow-sm"
          : "border-amber-500/30",
      )}
    >
      <CardHeader className="px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {isTop && (
                <Badge
                  variant="accent"
                  className="rounded-full px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.14em]"
                >
                  Meilleur
                </Badge>
              )}
              <span className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Coupon {rank}
              </span>
              {betStatus === "WON" && (
                <span className="text-[0.6rem] font-bold uppercase tracking-widest text-emerald-500">
                  ✓ Gagné
                </span>
              )}
              {betStatus === "LOST" && (
                <span className="text-[0.6rem] font-bold uppercase tracking-widest text-destructive">
                  ✗ Perdu
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Metric label="Cote" value={`@${combinedOdds.toFixed(2)}`} />
            <Metric
              label="Proba"
              value={formatPct(jointProbability)}
              valueClassName={probColor}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-2.5 px-4">
        <ProgressBar
          value={Math.round(probPct)}
          max={100}
          thresholds={{ success: 40, warning: 25 }}
          showValue={false}
        />

        <div className="flex flex-col gap-2">
          {legs.map((leg) => (
            <CouponLegCard key={leg.key} leg={leg} locale={locale} />
          ))}
        </div>

        {reasoning && (
          <p className="rounded-xl border border-dashed border-border/70 bg-background/20 px-3 py-2 text-xs leading-snug text-muted-foreground">
            {reasoning}
          </p>
        )}

        {actionSlot}
      </CardContent>
    </Card>
  );
}

function CouponLegCard({
  leg,
  locale,
}: {
  leg: NormalizedCouponLeg;
  locale: string;
}) {
  return (
    <FixtureCard
      fixture={`${leg.homeTeam} vs ${leg.awayTeam}`}
      homeLogo={leg.homeLogo}
      awayLogo={leg.awayLogo}
      competition={leg.competition}
      country={leg.country}
      kickoff={leg.kickoff}
      score={leg.score}
      htScore={leg.htScore}
      locale={locale}
      className="rounded-xl border-border/70 bg-background/20 shadow-none"
      headerExtra={
        <div className="flex shrink-0 items-center gap-2">
          {leg.odds && (
            <span className="font-mono text-xs text-muted-foreground">
              @{leg.odds}
            </span>
          )}
        </div>
      }
      bodyClassName="py-2"
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="line-clamp-2 min-w-0 text-xs font-semibold leading-snug">
            {leg.pickLabel}
          </p>
          <ResultBadge result={leg.result} finished={leg.score !== null} />
        </div>
        <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.68rem] leading-tight text-muted-foreground">
          <CanalBadge canal={leg.canal} />
          <span className="max-w-full truncate">{leg.marketLabel}</span>
          <span className="tabular-nums">{formatPct(leg.probability)}</span>
        </p>
      </div>
    </FixtureCard>
  );
}

function Metric({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/30 px-2.5 py-1.5 text-right">
      <p className="text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("text-xs font-semibold tabular-nums", valueClassName)}>
        {value}
      </p>
    </div>
  );
}

export function CouponSlipButton({
  allInSlip,
  onPlay,
}: {
  allInSlip: boolean;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
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
  );
}
