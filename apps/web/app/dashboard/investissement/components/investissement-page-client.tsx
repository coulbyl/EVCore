"use client";

import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import {
  Page,
  PageHeader,
  PageHeaderTitle,
  PageHeaderActions,
  PageContent,
  Skeleton,
  Badge,
  Button,
  Separator,
} from "@evcore/ui";
import { useLocale } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useInvestment } from "@/domains/ai-engine/use-cases/use-investment";
import { todayIso, daysAgoIso, formatTime, formatDateLong } from "@/lib/date";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import type {
  InvestmentCanal,
  InvestmentPickDto,
  InvestmentCouponDto,
} from "@/domains/ai-engine/types/investment";

const CANAL_COLOR: Record<InvestmentCanal, string> = {
  SV: "var(--canal-sv)",
  EV: "var(--canal-ev)",
  CONF: "var(--canal-conf)",
  BB: "var(--canal-btts)",
  NUL: "var(--canal-draw)",
};

const CANAL_LABEL: Record<InvestmentCanal, string> = {
  SV: "Safe Value",
  EV: "Expected Value",
  CONF: "Confiance",
  BB: "BTTS",
  NUL: "Nul",
};

const CANAL_ORDER: InvestmentCanal[] = ["SV", "BB", "CONF", "NUL", "EV"];

function formatPct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

function ResultBadge({ isCorrect }: { isCorrect: boolean | null }) {
  if (isCorrect === null) return null;
  return isCorrect ? (
    <span className="text-[0.6rem] font-bold uppercase tracking-widest text-emerald-500">
      ✓ Gagné
    </span>
  ) : (
    <span className="text-[0.6rem] font-bold uppercase tracking-widest text-destructive">
      ✗ Perdu
    </span>
  );
}

function PickCard({
  pick,
  locale,
}: {
  pick: InvestmentPickDto;
  locale: string;
}) {
  const color = CANAL_COLOR[pick.canal];
  const loc = locale === "en" ? "en" : "fr";
  const marketLabel = formatMarketForDisplay(pick.market, loc);
  const pickLabel = formatPickForDisplay(pick.pick, pick.market);

  return (
    <div className="rounded-lg border bg-card p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">
          {pick.homeTeam} <span className="text-muted-foreground">–</span>{" "}
          {pick.awayTeam}
        </span>
        <Badge
          className="shrink-0 text-[0.6rem] uppercase tracking-widest"
          style={{ backgroundColor: color, color: "#fff" }}
        >
          {pick.canal}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{marketLabel}</span>
        <span>·</span>
        <span className="font-semibold text-foreground">{pickLabel}</span>
        {pick.oddsSnapshot != null && (
          <>
            <span>·</span>
            <span className="font-mono">@{pick.oddsSnapshot.toFixed(2)}</span>
          </>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-foreground">
            {formatPct(pick.calibratedHitRate)}
          </span>
          <span className="text-muted-foreground/60">prob. calibrée</span>
          <ResultBadge isCorrect={pick.isCorrect} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="uppercase tracking-widest text-[0.6rem] font-medium opacity-60">
            {pick.competition}
          </span>
          <span className="opacity-40">·</span>
          <span className="opacity-60">{formatTime(pick.scheduledAt)}</span>
        </div>
      </div>

      {pick.reasoning && (
        <p className="text-xs text-muted-foreground italic leading-snug border-t pt-2 mt-0.5">
          {pick.reasoning}
        </p>
      )}
    </div>
  );
}

function CouponCard({
  coupon,
  locale,
  isTop,
}: {
  coupon: InvestmentCouponDto;
  locale: string;
  isTop: boolean;
}) {
  const loc = locale === "en" ? "en" : "fr";
  const probPct = coupon.jointProbability * 100;
  const probColor =
    probPct >= 40
      ? "text-emerald-500"
      : probPct >= 30
        ? "text-amber-500"
        : "text-muted-foreground";

  return (
    <div
      className={`rounded-lg border bg-card flex flex-col gap-3 ${isTop ? "p-5 border-primary/40 shadow-sm" : "p-4"}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isTop && (
            <span className="text-[0.6rem] font-bold uppercase tracking-widest text-primary">
              Meilleur
            </span>
          )}
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Coupon #{coupon.rank}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold ${probColor}`}>
            {formatPct(coupon.jointProbability)} prob.
          </span>
          <span className="font-mono font-bold text-sm">
            @{coupon.combinedOdds.toFixed(2)}
          </span>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        {coupon.legs.map((leg) => {
          const color = CANAL_COLOR[leg.canal];
          const marketLabel = formatMarketForDisplay(leg.market, loc);
          const pickLabel = formatPickForDisplay(leg.pick, leg.market);
          return (
            <div
              key={`${leg.fixtureId}:${leg.canal}`}
              className="flex flex-col gap-0.5 text-xs"
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="font-medium truncate">
                  {leg.homeTeam} – {leg.awayTeam}
                </span>
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  <ResultBadge isCorrect={leg.isCorrect} />
                  {leg.oddsSnapshot != null && (
                    <span className="font-mono text-muted-foreground">
                      @{leg.oddsSnapshot.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 pl-3.5 text-muted-foreground">
                <span className="font-mono uppercase tracking-widest text-[0.6rem]" style={{ color }}>
                  {leg.canal}
                </span>
                <span className="opacity-40">·</span>
                <span>{marketLabel} · {pickLabel}</span>
              </div>
            </div>
          );
        })}
      </div>

      {coupon.reasoning && (
        <p className="text-xs text-muted-foreground italic leading-snug border-t pt-2">
          {coupon.reasoning}
        </p>
      )}
    </div>
  );
}

function CanalSection({
  canal,
  picks,
  locale,
}: {
  canal: InvestmentCanal;
  picks: InvestmentPickDto[];
  locale: string;
}) {
  if (picks.length === 0) return null;
  const color = CANAL_COLOR[canal];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <h3 className="text-sm font-semibold">{CANAL_LABEL[canal]}</h3>
        <span className="text-xs text-muted-foreground">
          {picks.length} pick{picks.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {picks.map((pick) => (
          <PickCard
            key={`${pick.fixtureId}:${pick.canal}`}
            pick={pick}
            locale={locale}
          />
        ))}
      </div>
    </div>
  );
}

function SkeletonSection() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-28" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(iso: string): string {
  const today = todayIso();
  if (iso === today) return "Aujourd'hui";
  if (iso === daysAgoIso(1)) return "Hier";
  return formatDateLong(`${iso}T12:00:00Z`);
}

export function InvestissementPageClient() {
  const today = todayIso();
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = searchParams.get("date") ?? today;
  const locale = useLocale();
  const { data, isLoading, isError } = useInvestment(date);

  const hasAnyPicks =
    data && CANAL_ORDER.some((c) => (data.selections[c]?.length ?? 0) > 0);

  function navigate(days: number) {
    const next = shiftDate(date, days);
    const params = new URLSearchParams({ date: next });
    router.push(`/dashboard/investissement?${params.toString()}`);
  }

  return (
    <Page className="flex h-full flex-col">
      <PageHeader>
        <PageHeaderTitle>
          <TrendingUp className="size-5 shrink-0" />
          Investissement
        </PageHeaderTitle>
        <PageHeaderActions>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-medium min-w-28 text-center">
              {formatDateLabel(date)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => navigate(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          {data && !data.isAiCurated && (
            <span className="text-xs text-muted-foreground">
              Sélection automatique
            </span>
          )}
        </PageHeaderActions>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-hidden rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="flex h-full min-h-0 flex-col gap-5">
        <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-8 pb-6">
        {/* ── Top picks ─────────────────────────────────────────────── */}
        <section className="flex flex-col gap-6">
          <h2 className="text-base font-semibold">
            Top picks — {formatDateLabel(date)}
          </h2>

          {isLoading && (
            <div className="flex flex-col gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonSection key={i} />
              ))}
            </div>
          )}

          {isError && (
            <p className="text-sm text-destructive">
              Erreur de chargement. Réessayez plus tard.
            </p>
          )}

          {data && !hasAnyPicks && (
            <p className="text-sm text-muted-foreground">
              Pas de pick éligible pour cette date.
            </p>
          )}

          {data && hasAnyPicks && (
            <div className="flex flex-col gap-6">
              {CANAL_ORDER.map((canal) => (
                <CanalSection
                  key={canal}
                  canal={canal}
                  picks={data.selections[canal] ?? []}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Coupons ───────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold">Coupons du jour</h2>

          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-lg" />
              ))}
            </div>
          )}

          {data && data.coupons.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground">
              Aucun coupon composé pour cette date.
            </p>
          )}

          {data && data.coupons.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.coupons.map((coupon) => (
                <CouponCard
                  key={coupon.rank}
                  coupon={coupon}
                  locale={locale}
                  isTop={coupon.rank === 1}
                />
              ))}
            </div>
          )}
        </section>
        </div>
        </div>
        </div>
      </PageContent>
    </Page>
  );
}
