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

export type NormalizedCouponLeg = {
  key: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  countryLabel?: string;
  competitionLabel: string;
  canalColor: string;
  canalLabel: string;
  marketLabel: string;
  pickLabel: string;
  odds: string | null;
  isCorrect: boolean | null;
};

export type CouponCardProps = {
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

function LegResultMark({ isCorrect }: { isCorrect: boolean | null }) {
  if (isCorrect === true)
    return (
      <span className="text-xs font-bold text-emerald-500">✓</span>
    );
  if (isCorrect === false)
    return <span className="text-xs font-bold text-destructive">✗</span>;
  return null;
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

export function CouponCard({
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
                Coupon #{rank}
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
            <CardDescription className="text-sm">
              {legs.length} sélections combinées pour une cote totale de{" "}
              <span className="font-mono font-semibold text-foreground">
                @{combinedOdds.toFixed(2)}
              </span>
            </CardDescription>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/30 px-3 py-2 text-right">
            <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
              Proba
            </p>
            <p className={cn("text-sm font-semibold", probColor)}>
              {formatPct(jointProbability)}
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
          {legs.map((leg) => (
            <div
              key={leg.key}
              className="rounded-xl border border-border/60 bg-background/20 p-3"
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-1 size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: leg.canalColor }}
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
                    <div className="flex shrink-0 items-center gap-2">
                      <LegResultMark isCorrect={leg.isCorrect} />
                      {leg.odds && (
                        <span className="font-mono text-xs text-muted-foreground">
                          @{leg.odds}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className="font-mono uppercase tracking-widest"
                      style={{ color: leg.canalColor }}
                    >
                      {leg.canalLabel}
                    </span>
                    <span>·</span>
                    <span className="uppercase tracking-widest text-[0.6rem]">
                      {leg.countryLabel
                        ? `${leg.countryLabel} · ${leg.competitionLabel}`
                        : leg.competitionLabel}
                    </span>
                    <span>·</span>
                    <span>
                      {leg.marketLabel} · {leg.pickLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>
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
