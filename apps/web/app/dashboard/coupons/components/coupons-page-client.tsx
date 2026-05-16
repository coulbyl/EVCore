"use client";

import { useEffect, useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Page,
  PageContent,
  FilterBar,
  type FilterDef,
  type FilterState,
} from "@evcore/ui";
import { useTranslations } from "next-intl";
import { useCoupons } from "@/domains/ai-engine/use-cases/use-coupons";
import { useCouponCelebration } from "@/hooks/use-coupon-celebration";
import { todayIso } from "@/lib/date";
import { formatDiagnosticPickForDisplay } from "@/helpers/fixture";
import type {
  CouponProposalDto,
  CouponLegDto,
  CouponResult,
} from "@/domains/ai-engine/types/coupon";

const FILTER_DEFS: FilterDef[] = [{ key: "date", label: "Date", type: "date" }];

const CANAL_COLOR: Record<string, string> = {
  SV: "var(--canal-sv)",
  EV: "var(--canal-ev)",
  CONF: "var(--canal-conf)",
  BB: "var(--canal-btts)",
  NUL: "var(--canal-draw)",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function StatusDot({
  status,
  result,
}: {
  status: string;
  result: CouponResult | null;
}) {
  const base = "text-[0.6rem] font-bold uppercase tracking-widest text-white";
  if (result === "WON") return <span className={base}>Gagné ✓</span>;
  if (result === "LOST")
    return <span className={`${base} opacity-80`}>Perdu</span>;
  if (status === "PENDING")
    return <span className={`${base} opacity-60 font-medium`}>En attente</span>;
  return null;
}

function TeamLogo({ src, alt }: { src: string | null; alt: string }) {
  if (src)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className="size-4 object-contain" />
    );
  return <span className="size-4 rounded-full bg-secondary" />;
}

function LegRow({ leg }: { leg: CouponLegDto }) {
  const color = CANAL_COLOR[leg.canal] ?? "var(--canal-sv)";
  const pickLabel = formatDiagnosticPickForDisplay(leg.market, leg.pick);
  const time = formatTime(leg.scheduledAt);

  return (
    <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3 last:border-0">
      {/* Logos + Fixture */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <TeamLogo src={leg.homeLogo} alt={leg.homeTeam} />
          <p className="truncate text-[0.78rem] font-semibold leading-tight text-foreground">
            {leg.homeTeam}{" "}
            <span className="font-normal text-muted-foreground">-</span>{" "}
            {leg.awayTeam}
          </p>
          <TeamLogo src={leg.awayLogo} alt={leg.awayTeam} />
        </div>
        <p className="text-[0.65rem] text-muted-foreground">
          {leg.competition} · {time}
        </p>
      </div>

      {/* Pick + odds */}
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-[0.72rem] font-bold text-foreground">
          {pickLabel}
        </span>
        <div className="flex items-center gap-1.5">
          {leg.oddsSnapshot !== null && (
            <span
              className="tabular-nums text-[0.68rem] font-semibold"
              style={{ color }}
            >
              @{leg.oddsSnapshot.toFixed(2)}
            </span>
          )}
          {leg.isCorrect === true && (
            <span
              className="text-xs font-bold"
              style={{ color: "var(--canal-sv)" }}
            >
              ✓
            </span>
          )}
          {leg.isCorrect === false && (
            <span className="text-xs font-bold text-destructive">✗</span>
          )}
        </div>
      </div>
    </div>
  );
}

function CouponCard({ coupon }: { coupon: CouponProposalDto }) {
  const displayResult = coupon.result === "PARTIAL" ? "LOST" : coupon.result;
  const headerBg =
    displayResult === "WON"
      ? "bg-success"
      : displayResult === "LOST"
        ? "bg-destructive"
        : "bg-primary";

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-panel-strong shadow-sm">
      {/* Header */}
      <div
        className={`flex items-center justify-between ${headerBg} px-4 py-2.5`}
      >
        <span className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-white">
          #{coupon.rank}
        </span>
        <StatusDot status={coupon.status} result={displayResult} />
      </div>

      {/* Legs — grows to fill available space */}
      <div className="flex flex-1 flex-col">
        {coupon.legs.map((leg) => (
          <LegRow key={leg.id} leg={leg} />
        ))}
      </div>

      {/* Footer pinned to bottom */}
      <div className="flex items-center justify-between border-t border-border/60 bg-secondary/30 px-4 py-3">
        <div className="flex items-center gap-3 text-[0.65rem] text-muted-foreground">
          <span>
            Prob.{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {(coupon.jointProbability * 100).toFixed(1)}%
            </span>
          </span>
          <span className="h-3 w-px bg-border" />
          <span>
            Signal{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {(coupon.signalScore * 100).toFixed(0)}
            </span>
          </span>
        </div>

        <span className="text-xl font-black tabular-nums tracking-tight text-primary">
          ×{coupon.combinedOdds.toFixed(2)}
        </span>
      </div>
    </article>
  );
}

export function CouponsPageClient() {
  const t = useTranslations("coupons");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const date = searchParams.get("date") ?? todayIso();
  const { data, isLoading, isError } = useCoupons(date);

  const [filters, setFilters] = useState<FilterState>({ date });

  useEffect(() => {
    setFilters({ date });
  }, [date]);

  function handleFiltersChange(next: FilterState) {
    setFilters(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", (next.date as string) ?? todayIso());
    router.push(`${pathname}?${params.toString()}`);
  }

  const coupons = data ?? [];
  useCouponCelebration(coupons);

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-hidden rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="flex h-full min-h-0 flex-col gap-5">
          <section className="shrink-0">
            <FilterBar
              filters={FILTER_DEFS}
              value={filters}
              onChange={handleFiltersChange}
            />
          </section>

          <p className="shrink-0 text-[0.72rem] text-muted-foreground">
            {t("aiNote")}
          </p>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 size={22} className="animate-spin" />
              </div>
            )}

            {isError && !isLoading && (
              <div className="rounded-[1.2rem] border border-dashed border-border bg-panel/70 p-8 text-center text-sm text-muted-foreground">
                {t("loadError")}
              </div>
            )}

            {!isLoading && !isError && coupons.length === 0 && (
              <div className="flex flex-col items-center gap-4 rounded-[1.2rem] border border-dashed border-border bg-panel/70 px-8 py-16 text-center">
                <Trophy size={36} className="text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
              </div>
            )}

            {!isLoading && !isError && coupons.length > 0 && (
              <div className="grid grid-cols-1 items-stretch gap-4 pb-4 md:grid-cols-2 xl:grid-cols-3">
                {coupons.map((coupon) => (
                  <CouponCard key={coupon.id} coupon={coupon} />
                ))}
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
