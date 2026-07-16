"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight, FileText, Home, Video } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Page,
  PageContent,
  PageHeader,
  PageHeaderTitle,
  ProgressBar,
} from "@evcore/ui";
import { useTranslations } from "next-intl";
import { useFormationProgress } from "@/domains/formation/use-cases/use-formation-progress";
import type {
  FormationCategory,
  FormationContentMeta,
} from "@/domains/formation/types/formation";

function percent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

export function FormationCategoryShell({
  category,
  items,
  children,
}: {
  category: FormationCategory;
  items: FormationContentMeta[];
  children: React.ReactNode;
}) {
  const t = useTranslations("formation");
  const pathname = usePathname();
  const { isCompleted } = useFormationProgress();

  const completedCount = useMemo(() => {
    let count = 0;
    for (const item of items) {
      if (isCompleted(item.type, item.slug)) count += 1;
    }
    return count;
  }, [isCompleted, items]);

  const pct = percent(completedCount, items.length);

  return (
    <Page className="flex h-full flex-col">
      <PageHeader className="lg:flex-col lg:items-stretch lg:justify-start">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="rounded-xl">
            <Link href="/dashboard/formation">
              <Home size={16} data-icon="inline-start" />
              {t("label")}
            </Link>
          </Button>
          <ChevronRight size={16} className="text-border" />
          <PageHeaderTitle className="text-sm font-semibold">
            {t(`categories.${category}`)}
          </PageHeaderTitle>
        </div>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start">
          <aside className="lg:sticky lg:top-5">
            <Card className="flex flex-col overflow-hidden rounded-[1.6rem] border-border/80 bg-panel-strong shadow-[0_16px_44px_rgba(15,23,42,0.08)] lg:max-h-[calc(100vh-11rem)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {t(`categories.${category}`)}
                </CardTitle>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    {t("progress")}
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {pct}% · {completedCount}/{items.length}
                  </p>
                </div>
                <div className="mt-2">
                  <ProgressBar
                    value={completedCount}
                    max={Math.max(1, items.length)}
                  />
                </div>
              </CardHeader>

              <CardContent className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
                {items.map((item) => {
                  const href = `/dashboard/formation/${category}/${item.slug}`;
                  const active = pathname === href;
                  const done = isCompleted(item.type, item.slug);

                  return (
                    <Link
                      key={`${item.type}-${item.slug}`}
                      href={href}
                      className={`group flex items-start justify-between gap-3 rounded-2xl border px-3 py-2.5 transition-colors ${
                        active
                          ? "border-accent/30 bg-accent/10"
                          : "border-border bg-background/40 hover:bg-secondary"
                      }`}
                      data-testid="formation-category-item"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground group-hover:text-accent">
                          {item.title}
                        </p>
                        {item.summary ? (
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {item.summary}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="text-[0.68rem]">
                            {t(`difficulty.${item.difficulty}`)}
                          </Badge>
                          <Badge variant="outline" className="text-[0.68rem]">
                            {item.videoDuration ?? `${item.readTime} min`}
                          </Badge>
                          {done ? (
                            <Badge
                              variant="outline"
                              className="border-accent/30 text-[0.68rem]"
                            >
                              {t("completed")}
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      <span
                        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background ${
                          done ? "text-accent" : "text-muted-foreground"
                        }`}
                      >
                        {item.type === "video" ? (
                          <Video size={16} />
                        ) : (
                          <FileText size={16} />
                        )}
                      </span>
                    </Link>
                  );
                })}

                {items.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-background/30 p-4 text-sm text-muted-foreground">
                    {t("noResults")}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </aside>

          <main className="flex flex-col gap-5">{children}</main>
        </div>
      </PageContent>
    </Page>
  );
}
