"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  BookOpen,
  GraduationCap,
  Shapes,
  Shield,
  Sparkles,
} from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Page,
  PageContent,
  ProgressBar,
} from "@evcore/ui";
import { useTranslations } from "next-intl";
import { useFormationProgress } from "@/domains/formation/use-cases/use-formation-progress";
import type {
  FormationCategory,
  FormationContentMeta,
} from "@/domains/formation/types/formation";

const CATEGORY_ORDER: FormationCategory[] = [
  "bases",
  "channels",
  "bankroll",
  "leagues",
  "app",
];

function categoryLabel(
  t: ReturnType<typeof useTranslations>,
  category: FormationCategory,
): string {
  return t(`categories.${category}`);
}

function countCompleted(
  items: FormationContentMeta[],
  isCompleted: (type: FormationContentMeta["type"], slug: string) => boolean,
): number {
  let count = 0;
  for (const item of items) {
    if (isCompleted(item.type, item.slug)) count += 1;
  }
  return count;
}

function percent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

function categoryIcon(category: FormationCategory) {
  switch (category) {
    case "bases":
      return <Sparkles size={16} />;
    case "channels":
      return <Shapes size={16} />;
    case "bankroll":
      return <Shield size={16} />;
    case "leagues":
      return <BookOpen size={16} />;
    case "app":
      return <GraduationCap size={16} />;
  }
}

export function FormationPageClient({
  items,
}: {
  items: FormationContentMeta[];
}) {
  const t = useTranslations("formation");
  const { isCompleted } = useFormationProgress();

  const total = items.length;
  const totalCompleted = useMemo(
    () => countCompleted(items, isCompleted),
    [isCompleted, items],
  );
  const totalPercent = percent(totalCompleted, total);

  const byCategory = useMemo(() => {
    const map = new Map<FormationCategory, FormationContentMeta[]>();
    for (const item of items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [items]);

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-5">
          <div className="sticky top-0 z-20 -mx-4 -mt-4 px-4 pt-4 backdrop-blur supports-backdrop-filter:bg-panel-strong/95 sm:-mx-5 sm:px-5 sm:pt-5">
            <header className="flex flex-col gap-4 rounded-[1.8rem] border border-border bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--accent)_16%,transparent)_0%,transparent_70%)] p-4 shadow-[0_14px_40px_rgba(15,23,42,0.08)] sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-11 items-center justify-center rounded-2xl border border-border bg-secondary text-accent shadow-xs">
                      <GraduationCap size={18} />
                    </span>
                    <div className="min-w-0">
                      <h1 className="truncate text-[1.2rem] font-semibold tracking-tight text-foreground sm:text-[1.55rem]">
                        {t("title")}
                      </h1>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {t("subtitle")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="hidden w-60 shrink-0 sm:block">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    {t("progress")}
                  </p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                    {totalPercent}% · {totalCompleted} / {total}
                  </p>
                  <div className="mt-2">
                    <ProgressBar
                      value={totalCompleted}
                      max={Math.max(1, total)}
                    />
                  </div>
                </div>
              </div>

              <div className="sm:hidden">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    {t("progress")}
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {totalCompleted} / {total}
                  </p>
                </div>
                <div className="mt-2">
                  <ProgressBar
                    value={totalCompleted}
                    max={Math.max(1, total)}
                  />
                </div>
              </div>
            </header>
          </div>

          {/* Categories */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORY_ORDER.map((cat) => {
              const catItems = byCategory.get(cat) ?? [];
              const completed = countCompleted(catItems, isCompleted);
              const pct = percent(completed, catItems.length);
              return (
                <Link
                  key={cat}
                  href={`/dashboard/formation/${cat}`}
                  className="group rounded-[1.6rem] border border-border/80 bg-panel-strong shadow-[0_16px_44px_rgba(15,23,42,0.08)] transition-colors hover:border-accent/30 hover:bg-secondary"
                  data-testid="formation-category-link"
                >
                  <Card className="border-0 bg-transparent shadow-none">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="text-base">
                            {categoryLabel(t, cat)}
                          </CardTitle>
                          <CardDescription className="mt-1 text-sm">
                            {completed} / {catItems.length}
                          </CardDescription>
                        </div>
                        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary text-accent transition-colors group-hover:border-accent/30">
                          {categoryIcon(cat)}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                          {pct}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("itemsCount", { count: catItems.length })}
                        </p>
                      </div>
                      <ProgressBar
                        value={completed}
                        max={Math.max(1, catItems.length)}
                      />
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="gap-1">
                          {t("open")}
                        </Badge>
                        <span className="text-xs font-semibold text-accent">
                          {t("browse")} →
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </section>
        </div>
      </PageContent>
    </Page>
  );
}
