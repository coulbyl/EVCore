"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  PlayCircle,
  Video,
} from "lucide-react";
import {
  Badge,
  Button,
  Page,
  PageContent,
  PageHeader,
  PageHeaderTitle,
  ProgressBar,
} from "@evcore/ui";
import { useTranslations } from "next-intl";
import { cn } from "@evcore/ui/lib/utils";
import { useFormationProgress } from "@/domains/formation/use-cases/use-formation-progress";
import {
  FORMATION_CATEGORIES,
  type FormationCategory,
  type FormationContentMeta,
} from "@/domains/formation/types/formation";

function sortByCategoryThenOrder(
  items: FormationContentMeta[],
): FormationContentMeta[] {
  return items.slice().sort((a, b) => {
    const catDiff =
      FORMATION_CATEGORIES.indexOf(a.category) -
      FORMATION_CATEGORIES.indexOf(b.category);
    if (catDiff !== 0) return catDiff;
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return a.title.localeCompare(b.title);
  });
}

function itemDuration(item: FormationContentMeta): string {
  return item.videoDuration ?? `${item.readTime} min`;
}

function TypeIcon({
  type,
  size = 14,
}: {
  type: FormationContentMeta["type"];
  size?: number;
}) {
  return type === "video" ? <Video size={size} /> : <FileText size={size} />;
}

export function FormationPageClient({
  items,
}: {
  items: FormationContentMeta[];
}) {
  const t = useTranslations("formation");
  const { isCompleted, progress } = useFormationProgress();
  const [activeCategory, setActiveCategory] = useState<
    FormationCategory | "all"
  >("all");

  const sorted = useMemo(() => sortByCategoryThenOrder(items), [items]);

  const availableCategories = useMemo(
    () =>
      FORMATION_CATEGORIES.filter((cat) =>
        sorted.some((item) => item.category === cat),
      ),
    [sorted],
  );

  const visibleItems = useMemo(
    () =>
      activeCategory === "all"
        ? sorted
        : sorted.filter((item) => item.category === activeCategory),
    [sorted, activeCategory],
  );

  const completedCount = useMemo(
    () => sorted.filter((item) => isCompleted(item.type, item.slug)).length,
    [isCompleted, sorted]
  );
  const totalPercent =
    sorted.length > 0
      ? Math.round((completedCount / sorted.length) * 100)
      : 0;

  const itemBySlug = useMemo(
    () => new Map(sorted.map((item) => [item.slug, item])),
    [sorted],
  );

  const recentItem = useMemo(() => {
    const recent = progress.recent;
    if (!recent) return null;
    return itemBySlug.get(recent.slug) ?? null;
  }, [progress.recent, itemBySlug]);

  const featuredItem = recentItem ?? sorted[0] ?? null;

  return (
    <Page className="flex h-full flex-col">
      <PageHeader className="lg:flex-col lg:items-stretch lg:justify-start">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-11 items-center justify-center rounded-2xl border border-border bg-secondary text-accent shadow-xs">
                <GraduationCap size={18} />
              </span>
              <div className="min-w-0">
                <PageHeaderTitle className="truncate text-[1.2rem] font-semibold tracking-tight sm:text-[1.55rem]">
                  {t("title")}
                </PageHeaderTitle>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {t("subtitle")}
                </p>
              </div>
            </div>
          </div>

          <div className="w-full shrink-0 md:w-64">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {t("progress")}
              </p>
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {completedCount} / {Math.max(1, sorted.length)}
              </p>
            </div>
            <div className="mt-2">
              <ProgressBar
                value={completedCount}
                max={Math.max(1, sorted.length)}
                showValue={false}
              />
            </div>
            <p className="mt-2 text-xs tabular-nums text-muted-foreground">
              {totalPercent}%
            </p>
          </div>
        </div>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-5">
          {featuredItem ? (
            <section className="overflow-hidden rounded-[1.6rem] border border-border bg-panel-strong ev-shell-shadow">
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
                <Link
                  href={`/dashboard/formation/${featuredItem.slug}`}
                  className="group relative flex min-h-[13rem] flex-col justify-end overflow-hidden bg-secondary p-5 sm:min-h-[16rem] sm:p-6"
                  data-testid="formation-featured-link"
                >
                  <div className="absolute inset-0 border-b border-border bg-background/20" />
                  <div className="absolute inset-x-5 top-5 flex items-center justify-between gap-3">
                    <Badge variant="accent" className="gap-1">
                      <PlayCircle size={12} />
                      {recentItem ? t("continue") : t("recommended")}
                    </Badge>
                    <Badge variant="secondary" className="gap-1 tabular-nums">
                      <Clock size={12} />
                      {itemDuration(featuredItem)}
                    </Badge>
                  </div>

                  <div className="relative max-w-2xl">
                    <span className="mb-4 inline-flex size-14 items-center justify-center rounded-full border border-border bg-background/80 text-accent shadow-xs transition-transform group-hover:scale-105">
                      <TypeIcon type={featuredItem.type} size={24} />
                    </span>
                    <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                      {featuredItem.title}
                    </h2>
                    {featuredItem.summary ? (
                      <p className="mt-2 line-clamp-2 max-w-xl text-sm leading-6 text-muted-foreground">
                        {featuredItem.summary}
                      </p>
                    ) : null}
                  </div>
                </Link>

                <div className="flex flex-col justify-between gap-5 border-t border-border p-5 lg:border-l lg:border-t-0">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {t(`categories.${featuredItem.category}`)}
                      </Badge>
                      <Badge variant="outline">
                        {t(`difficulty.${featuredItem.difficulty}`)}
                      </Badge>
                      {isCompleted(featuredItem.type, featuredItem.slug) ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 size={12} />
                          {t("completed")}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <Button asChild className="w-full rounded-xl sm:w-fit">
                    <Link href={`/dashboard/formation/${featuredItem.slug}`}>
                      {recentItem ? t("continue") : t("open")}
                      <ChevronRight data-icon="inline-end" />
                    </Link>
                  </Button>
                </div>
              </div>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
            >
              {t("allCategories")}
            </FilterChip>
            {availableCategories.map((cat) => (
              <FilterChip
                key={cat}
                active={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
              >
                {t(`categories.${cat}`)}
              </FilterChip>
            ))}
          </div>

          {visibleItems.length > 0 ? (
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleItems.map((item) => (
                <FormationItemCard
                  key={`${item.type}-${item.slug}`}
                  item={item}
                  completed={isCompleted(item.type, item.slug)}
                />
              ))}
            </section>
          ) : (
            <p className="rounded-2xl border border-border bg-panel-strong p-6 text-center text-sm text-muted-foreground">
              {t("noResults")}
            </p>
          )}
        </div>
      </PageContent>
    </Page>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-transparent bg-accent text-accent-foreground"
          : "border-border bg-panel text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function FormationItemCard({
  item,
  completed,
}: {
  item: FormationContentMeta;
  completed: boolean;
}) {
  const t = useTranslations("formation");

  return (
    <Link
      href={`/dashboard/formation/${item.slug}`}
      className="bento-cell-interactive group flex min-h-[12.5rem] flex-col justify-between gap-4 p-4"
      data-testid="formation-item-card"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary text-accent transition-transform group-hover:scale-105">
          <TypeIcon type={item.type} size={18} />
        </span>
        <div className="flex flex-wrap justify-end gap-2">
          {completed ? (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 size={12} />
              {t("completed")}
            </Badge>
          ) : null}
          <Badge variant="secondary" className="gap-1 tabular-nums">
            <Clock size={12} />
            {itemDuration(item)}
          </Badge>
        </div>
      </div>

      <div className="min-w-0">
        <p className="line-clamp-2 text-base font-semibold tracking-tight text-foreground">
          {item.title}
        </p>
        {item.summary ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {item.summary}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Badge variant="outline" className="gap-1">
          {t(`categories.${item.category}`)}
        </Badge>
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors group-hover:text-foreground">
          <ChevronRight size={16} />
        </span>
      </div>
    </Link>
  );
}
