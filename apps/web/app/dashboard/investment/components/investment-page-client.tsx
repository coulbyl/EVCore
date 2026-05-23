"use client";

import { useState } from "react";
import Image from "next/image";
import {
  BarChart2,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShoppingCart,
  Target,
  Ticket,
} from "lucide-react";
import {
  Page,
  PageHeader,
  PageHeaderActions,
  PageContent,
  Skeleton,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
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
import { formatScore } from "@/domains/fixture/helpers/fixture";
import type {
  InvestmentCanal,
  InvestmentCouponDto,
  InvestmentPickDto,
} from "@/domains/ai-engine/types/investment";
import { useBetSlip } from "@/domains/bet-slip/context/bet-slip-context";
import {
  draftItemKey,
  type BetSlipDraftItem,
} from "@/domains/bet-slip/types/bet-slip";
import { InvestmentIndicesDrawer } from "@/components/investment-indices-drawer";
import type { InvestmentIndicesCanal } from "@/domains/ai-engine/types/investment-indices";
import { useIsMobile } from "@/hooks/use-mobile";

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

function summarizeDay(data: {
  selections: Record<InvestmentCanal, InvestmentPickDto[]>;
  coupons: InvestmentCouponDto[];
}) {
  const picks = CANAL_ORDER.flatMap((canal) => data.selections[canal] ?? []);
  const settled = picks.filter((pick) => pick.isCorrect !== null);
  const wins = settled.filter((pick) => pick.isCorrect).length;
  const avgHitRate =
    picks.length > 0
      ? picks.reduce((sum, pick) => sum + pick.probability, 0) / picks.length
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

function SlipButton({ pick }: { pick: InvestmentPickDto }) {
  const { draft, addItem, removeItem, isInSlip, open } = useBetSlip();

  if (pick.isCorrect !== null) return null;

  const key = draftItemKey({
    fixtureId: pick.fixtureId,
    market: pick.market,
    pick: pick.pick,
  });
  const inSlip = isInSlip(key);
  const color = CANAL_COLOR[pick.canal];

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (inSlip) {
      removeItem(key);
      return;
    }
    const item: BetSlipDraftItem = {
      fixtureId: pick.fixtureId,
      fixture: `${pick.homeTeam} vs ${pick.awayTeam}`,
      homeLogo: pick.homeLogo,
      awayLogo: pick.awayLogo,
      competition: pick.competition,
      scheduledAt: pick.scheduledAt,
      market: pick.market,
      pick: pick.pick,
      odds: pick.oddsSnapshot != null ? pick.oddsSnapshot.toFixed(2) : null,
      ev: null,
      stakeOverride: null,
      ...(pick.betId
        ? { betId: pick.betId }
        : { modelRunId: pick.modelRunId ?? undefined }),
    };
    addItem(item);
    if (draft.items.length === 0) open();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={inSlip ? "Retirer du coupon" : "Ajouter au coupon"}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
        inSlip
          ? "border-success/20 bg-success/12 text-success"
          : "border-border bg-secondary text-muted-foreground hover:text-foreground",
      )}
      style={!inSlip ? { color } : undefined}
    >
      {inSlip ? <Check size={12} /> : <ShoppingCart size={12} />}
    </button>
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
  const confidencePct = Math.round(pick.probability * 100);
  const scoreLabel = formatScore(pick.score, pick.htScore);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/70 bg-card p-3 pl-4 flex flex-col gap-1.5 transition-colors hover:border-border">
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: color }}
      />

      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs font-semibold leading-snug">
          {pick.homeLogo && (
            <Image
              src={pick.homeLogo}
              alt={pick.homeTeam}
              width={14}
              height={14}
              className="size-3.5 shrink-0 object-contain"
            />
          )}
          <span className="truncate">{pick.homeTeam}</span>
          <span className="font-normal text-muted-foreground">–</span>
          {pick.awayLogo && (
            <Image
              src={pick.awayLogo}
              alt={pick.awayTeam}
              width={14}
              height={14}
              className="size-3.5 shrink-0 object-contain"
            />
          )}
          <span className="truncate">{pick.awayTeam}</span>
        </span>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-bold tabular-nums"
          style={{
            color,
            background: `color-mix(in srgb, ${color} 14%, transparent)`,
          }}
        >
          {confidencePct}%
        </span>
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
          {scoreLabel && (
            <span className="font-mono text-foreground">{scoreLabel}</span>
          )}
          <ResultBadge isCorrect={pick.isCorrect} />
          <SlipButton pick={pick} />
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
}: {
  data: {
    totalCandidates: number;
    selections: Record<InvestmentCanal, InvestmentPickDto[]>;
    coupons: InvestmentCouponDto[];
  } | null;
}) {
  if (!data) return null;

  const summary = summarizeDay(data);
  const MAX_SLOTS = 5 + 5 + 5 + 2 + 2; // SV+BB+CONF+NUL+EV
  const isLowActivity = data.totalCandidates <= MAX_SLOTS;

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
            {isLowActivity && (
              <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-warning">
                Faible activité
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-4 gap-2 px-4">
          <StatCard
            label="Candidats"
            value={String(data.totalCandidates)}
            icon={<Brain className="size-3.5" />}
            compact
            tone={isLowActivity ? "warning" : undefined}
          />
          <StatCard
            label="Sélectionnés"
            value={String(summary.totalPicks)}
            icon={<Target className="size-3.5" />}
            compact
          />
          <StatCard
            label="Coupons"
            value={String(summary.totalCoupons)}
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
                        <span className="font-normal text-muted-foreground">
                          –
                        </span>
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

function CanalSection({
  canal,
  picks,
  locale,
  isMobile,
}: {
  canal: InvestmentCanal;
  picks: InvestmentPickDto[];
  locale: string;
  isMobile: boolean;
}) {
  const [indicesOpen, setIndicesOpen] = useState(false);
  if (picks.length === 0) return null;
  const color = CANAL_COLOR[canal];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className="h-3.5 w-1 shrink-0 rounded-full"
          style={{ background: color }}
        />
        <h3 className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {CANAL_LABEL[canal]}
        </h3>
        <span
          className="rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold tabular-nums"
          style={{
            color,
            background: `color-mix(in srgb, ${color} 14%, transparent)`,
          }}
        >
          {picks.length}
        </span>
        <span className="text-[0.65rem] text-muted-foreground/60">
          {CANAL_DESCRIPTION[canal]}
          <span className="ml-1.5 tabular-nums opacity-70">
            hist. {formatPct(picks[0]?.calibratedHitRate ?? 0)}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setIndicesOpen(true)}
          className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-secondary px-2 py-1 text-[0.65rem] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <BarChart2 size={11} />
          Indice
        </button>
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

      <InvestmentIndicesDrawer
        canal={canal as InvestmentIndicesCanal}
        open={indicesOpen}
        onClose={() => setIndicesOpen(false)}
        isMobile={isMobile}
      />
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

export function InvestissementPageClient() {
  const today = todayIso();
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = searchParams.get("date") ?? today;
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [couponIndicesOpen, setCouponIndicesOpen] = useState(false);
  const locale = useLocale();
  const isMobile = useIsMobile();
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
        <div />
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
              <HeroInsights data={data ?? null} />

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
                        isMobile={isMobile}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">Coupons du jour</h2>
                    <p className="text-sm text-muted-foreground">
                      Combinaisons prêtes à lire avec cote, proba jointe et
                      détail de chaque jambe.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCouponIndicesOpen(true)}
                    className="mt-0.5 flex shrink-0 items-center gap-1 rounded-lg border border-border bg-secondary px-2 py-1 text-[0.65rem] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <BarChart2 size={11} />
                    Indice
                  </button>
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

      <InvestmentIndicesDrawer
        canal="COUPON"
        open={couponIndicesOpen}
        onClose={() => setCouponIndicesOpen(false)}
        isMobile={isMobile}
      />
    </Page>
  );
}
