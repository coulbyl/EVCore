"use client";

import { useState } from "react";
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Target,
  Ticket,
  TrendingUp,
} from "lucide-react";
import {
  Page,
  PageHeader,
  PageHeaderTitle,
  PageHeaderActions,
  PageContent,
  Skeleton,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Separator,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Calendar,
  ProgressBar,
  StatCard,
  cn,
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
  InvestmentCouponDto,
  InvestmentPickDto,
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

const CANAL_DESCRIPTION: Record<InvestmentCanal, string> = {
  SV: "Sélections prudentes à rendement régulier.",
  BB: "Matchs ouverts avec potentiel des deux côtés.",
  CONF: "Angles les plus affirmés du modèle.",
  NUL: "Scénarios de marché plus rares mais payants.",
  EV: "Cotes plus agressives avec valeur attendue.",
};

const CANAL_ORDER: InvestmentCanal[] = ["SV", "BB", "CONF", "NUL", "EV"];

function formatPct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

function formatCount(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value > 1 ? plural : singular}`;
}

function summarizeDay(data: {
  selections: Record<InvestmentCanal, InvestmentPickDto[]>;
  coupons: InvestmentCouponDto[];
}) {
  const picks = CANAL_ORDER.flatMap((canal) => data.selections[canal] ?? []);
  const settled = picks.filter((pick) => pick.isCorrect !== null);
  const wins = settled.filter((pick) => pick.isCorrect).length;
  const avgHitRate =
    picks.length > 0
      ? picks.reduce((sum, pick) => sum + pick.calibratedHitRate, 0) /
        picks.length
      : 0;

  return {
    totalPicks: picks.length,
    totalCoupons: data.coupons.length,
    settledCount: settled.length,
    wins,
    avgHitRate,
    bestCoupon: data.coupons[0] ?? null,
  };
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
  const confidencePct = Math.round(pick.calibratedHitRate * 100);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/70 bg-card p-3 pl-4 flex flex-col gap-1.5 transition-colors hover:border-border">
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: color }}
      />

      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold leading-snug truncate">
          {pick.homeTeam} <span className="text-muted-foreground">–</span>{" "}
          {pick.awayTeam}
        </span>
        <Badge
          className="shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.16em]"
          style={{ backgroundColor: color, color: "#fff" }}
        >
          {pick.canal}
        </Badge>
      </div>

      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{marketLabel}</span>
        {" · "}
        <span className="font-medium text-foreground">{pickLabel}</span>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
        <span className="uppercase tracking-widest text-[0.6rem]">
          {pick.competition}
        </span>
        <span className="opacity-40">·</span>
        <span>{formatTime(pick.scheduledAt)}</span>
        {pick.oddsSnapshot != null && (
          <>
            <span className="opacity-40">·</span>
            <span className="font-mono text-foreground">
              @{pick.oddsSnapshot.toFixed(2)}
            </span>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono font-semibold text-foreground">
            {confidencePct}%
          </span>
          <ResultBadge isCorrect={pick.isCorrect} />
        </div>
      </div>

      {pick.reasoning && (
        <p className="border-t border-border/50 pt-1.5 text-xs leading-snug text-muted-foreground">
          {pick.reasoning}
        </p>
      )}
    </div>
  );
}

function HeroInsights({
  data,
  date,
}: {
  data: {
    selections: Record<InvestmentCanal, InvestmentPickDto[]>;
    coupons: InvestmentCouponDto[];
  } | null;
  date: string;
}) {
  if (!data) return null;

  const summary = summarizeDay(data);
  const settledRate =
    summary.settledCount > 0 ? summary.wins / summary.settledCount : 0;

  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-[1.25fr_0.75fr]">
      <Card className="overflow-hidden rounded-[1.35rem] border-primary/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_32%)] py-3">
        <CardHeader className="gap-1 px-4 pb-2">
          <div className="flex items-center gap-2">
            <Badge
              variant="accent"
              className="w-fit rounded-full px-2.5 py-0.5 text-[0.6rem] uppercase tracking-[0.18em]"
            >
              Vue rapide
            </Badge>
            <CardTitle className="text-sm font-semibold">
              Picks {formatDateWithPrep(date)}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2 px-4">
          <StatCard
            label="Volume"
            value={formatCount(summary.totalPicks, "pick")}
            icon={<Target className="size-3.5" />}
            compact
          />
          <StatCard
            label="Coupons"
            value={formatCount(summary.totalCoupons, "coupon")}
            icon={<Ticket className="size-3.5" />}
            compact
          />
          <StatCard
            label="Confiance Moy."
            value={formatPct(summary.avgHitRate)}
            icon={<Brain className="size-3.5" />}
            compact
            tone="success"
          />
        </CardContent>
      </Card>

      <Card className="rounded-[1.35rem] py-3 border-amber-500/30 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.06),transparent_40%)]">
        <CardHeader className="gap-1 px-4 pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Lecture du jour
            </CardTitle>
            <CardDescription className="text-xs">
              {summary.settledCount > 0
                ? `${summary.wins} gagnés / ${summary.settledCount}`
                : "Non réglé"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 px-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Taux de réussite
            </span>
            <span className="text-xs font-semibold text-foreground">
              {summary.settledCount > 0 ? formatPct(settledRate) : "—"}
            </span>
          </div>
          <ProgressBar
            value={Math.round(settledRate * 100)}
            max={100}
            thresholds={{ success: 55, warning: 35 }}
            showValue={false}
          />

          {summary.bestCoupon ? (
            <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/20 px-3 py-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Coupon #1
              </span>
              <span className="text-xs text-muted-foreground">
                {formatPct(summary.bestCoupon.jointProbability)} ·{" "}
                {summary.bestCoupon.legs.length} matchs
              </span>
              <Badge variant="success" className="rounded-full text-[0.6rem]">
                @{summary.bestCoupon.combinedOdds.toFixed(2)}
              </Badge>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Aucun coupon disponible.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
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
                      <p className="truncate text-sm font-medium">
                        {leg.homeTeam} – {leg.awayTeam}
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
      </CardContent>
    </Card>
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
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-[1.4rem] border border-border/80 bg-background/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className="mt-1 size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">{CANAL_LABEL[canal]}</h3>
              <Badge variant="outline" className="rounded-full">
                {formatCount(picks.length, "pick")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {CANAL_DESCRIPTION[canal]}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map((pick) => (
          <PickCard
            key={`${pick.fixtureId}:${pick.canal}`}
            pick={pick}
            locale={locale}
          />
        ))}
      </div>
    </section>
  );
}

function SkeletonSection() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-28 rounded-[1.4rem]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-[1.35rem]" />
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

function formatDateWithPrep(iso: string): string {
  const label = formatDateLabel(iso);
  if (label === "Aujourd'hui") return "d'aujourd'hui";
  if (label === "Hier") return "d'hier";
  return `du ${label}`;
}

export function InvestissementPageClient() {
  const today = todayIso();
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = searchParams.get("date") ?? today;
  const [calendarOpen, setCalendarOpen] = useState(false);
  const locale = useLocale();
  const { data, isLoading, isError } = useInvestment(date);

  const hasAnyPicks =
    data && CANAL_ORDER.some((c) => (data.selections[c]?.length ?? 0) > 0);

  function navigate(days: number) {
    const next = shiftDate(date, days);
    navigateTo(next);
  }

  function navigateTo(iso: string) {
    const params = new URLSearchParams({ date: iso });
    router.push(`/dashboard/investment?${params.toString()}`);
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
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-7 min-w-28 px-2 text-sm font-medium"
                >
                  {formatDateLabel(date)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={new Date(`${date}T12:00:00Z`)}
                  onSelect={(d) => {
                    if (!d) return;
                    const iso = d.toISOString().slice(0, 10);
                    setCalendarOpen(false);
                    navigateTo(iso);
                  }}
                  autoFocus
                />
              </PopoverContent>
            </Popover>
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
              <HeroInsights data={data ?? null} date={date} />

              <section className="flex flex-col gap-6">
                <div>
                  <h2 className="text-base font-semibold">Top picks</h2>
                  <p className="text-sm text-muted-foreground">
                    Les sélections sont regroupées par stratégie pour réduire le
                    bruit et accélérer la lecture.
                  </p>
                </div>

                {isLoading && (
                  <div className="flex flex-col gap-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <SkeletonSection key={i} />
                    ))}
                  </div>
                )}

                {isError && (
                  <Empty className="rounded-[1.6rem] border-border bg-background/20">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <ShieldCheck className="size-5" />
                      </EmptyMedia>
                      <EmptyTitle>Chargement impossible</EmptyTitle>
                      <EmptyDescription>
                        Erreur de chargement. Réessayez plus tard.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}

                {data && !hasAnyPicks && (
                  <Empty className="rounded-[1.6rem] border-border bg-background/20">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Target className="size-5" />
                      </EmptyMedia>
                      <EmptyTitle>Aucun pick éligible</EmptyTitle>
                      <EmptyDescription>
                        Le moteur n’a pas retenu de sélection exploitable pour
                        cette date.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}

                {data && hasAnyPicks && (
                  <div className="flex flex-col gap-7">
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

              <section className="flex flex-col gap-4">
                <div>
                  <h2 className="text-base font-semibold">Coupons du jour</h2>
                  <p className="text-sm text-muted-foreground">
                    Combinaisons prêtes à lire avec cote, proba jointe et détail
                    de chaque jambe.
                  </p>
                </div>

                {isLoading && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-72 rounded-[1.45rem]" />
                    ))}
                  </div>
                )}

                {data && data.coupons.length === 0 && !isLoading && (
                  <Empty className="rounded-[1.6rem] border-border bg-background/20">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Ticket className="size-5" />
                      </EmptyMedia>
                      <EmptyTitle>Aucun coupon composé</EmptyTitle>
                      <EmptyDescription>
                        Aucune combinaison n’est proposée pour cette date.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}

                {data && data.coupons.length > 0 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
