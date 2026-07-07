"use client";

import { Loader2, TrendingUp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Page,
  PageHeader,
  PageHeaderActions,
  PageContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@evcore/ui";
import { useTranslations, useLocale } from "next-intl";
import { useInvestmentPicks } from "@/domains/investment/use-cases/use-investment-picks";
import type { InvestmentMode } from "@/domains/investment/types/investment";
import { todayIso } from "@/lib/date";
import { DateNav } from "@/components/date-nav";
import { cn } from "@evcore/ui";
import { groupPicksByFixture } from "./investment-constants";
import { InvestmentFixtureCard } from "./investment-fixture-card";
import { InvestmentModeToggle } from "./investment-mode-toggle";

const VALID_MODES: InvestmentMode[] = [
  "probability",
  "value",
  "safe",
  "dominant",
  "btts",
  "goals",
  "draw",
];

// DOMINANT/BTTS/GOALS have a negative aggregate settled ROI played solo
// (checked 2026-07-06) — their tab keeps the same warning tone as the
// per-pick "channelRoiFlag" badge instead of implying they're validated
// positions like Value/Safe/Nul.
const NEGATIVE_ROI_MODES: InvestmentMode[] = ["dominant", "btts", "goals"];

// Options du filtre topN — bornées par INVESTMENT_LIMITS.maxPicks côté
// backend (15) ; hors de cette liste, le backend garde son défaut par mode.
const TOP_N_OPTIONS = [3, 5, 10, 15] as const;

export function InvestmentPageClient() {
  const t = useTranslations("investment");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const date = searchParams.get("date") ?? todayIso();
  const modeParam = searchParams.get("mode");
  const mode: InvestmentMode = VALID_MODES.includes(modeParam as InvestmentMode)
    ? (modeParam as InvestmentMode)
    : "probability";
  const topNParam = Number(searchParams.get("topN"));
  const topN = (TOP_N_OPTIONS as readonly number[]).includes(topNParam)
    ? topNParam
    : null;
  const { data, isLoading, isError } = useInvestmentPicks({ date, mode, topN });

  const picks = data ?? [];
  const fixtureGroups = groupPicksByFixture(picks);

  // next.topN : undefined = inchangé, null = retour au défaut du mode
  function navigateTo(next: {
    date?: string;
    mode?: InvestmentMode;
    topN?: number | null;
  }) {
    const params = new URLSearchParams({
      date: next.date ?? date,
      mode: next.mode ?? mode,
    });
    const nextTopN = next.topN === undefined ? topN : next.topN;
    if (nextTopN !== null) params.set("topN", String(nextTopN));
    router.push(`/dashboard/investment?${params.toString()}`);
  }

  return (
    <Page className="flex h-full flex-col">
      <PageHeader>
        <InvestmentModeToggle
          mode={mode}
          onChange={(next) => navigateTo({ mode: next })}
        />
        <PageHeaderActions className="w-full lg:w-auto">
          <Select
            value={topN === null ? "auto" : String(topN)}
            onValueChange={(value) =>
              navigateTo({ topN: value === "auto" ? null : Number(value) })
            }
          >
            <SelectTrigger
              aria-label={t("topNLabel")}
              className="w-full lg:w-auto lg:min-w-28"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">{t("topNAuto")}</SelectItem>
              {TOP_N_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Top {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateNav
            date={date}
            onChange={(iso) => navigateTo({ date: iso })}
            className="w-full lg:w-auto"
          />
        </PageHeaderActions>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-hidden p-4 sm:p-5 ev-shell-shadow">
        <div className="flex h-full min-h-0 flex-col gap-5">
          <p
            className={cn(
              "shrink-0 text-[0.72rem]",
              NEGATIVE_ROI_MODES.includes(mode)
                ? "font-medium text-warning"
                : "text-muted-foreground",
            )}
          >
            {mode === "probability"
              ? t("subtitle")
              : t(`subtitleByMode.${mode}`)}
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

            {!isLoading && !isError && picks.length === 0 && (
              <div className="flex flex-col items-center gap-4 rounded-[1.2rem] border border-dashed border-border bg-panel/70 px-8 py-16 text-center">
                <TrendingUp size={36} className="text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
              </div>
            )}

            {!isLoading && !isError && picks.length > 0 && (
              <div className="columns-1 gap-4 pb-4 sm:columns-2 lg:columns-3">
                {fixtureGroups.map((group) => (
                  <div
                    key={group.fixtureId}
                    className="mb-4 break-inside-avoid"
                  >
                    <InvestmentFixtureCard group={group} locale={locale} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
