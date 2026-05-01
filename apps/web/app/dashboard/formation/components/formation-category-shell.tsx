"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ChevronRight,
  Home,
  List,
  Search,
  Video,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  Input,
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
import { FormationProgressSync } from "./formation-progress-sync";

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

  const [query, setQuery] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [remoteMatches, setRemoteMatches] = useState<Set<string> | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const localFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.summary ?? "").toLowerCase().includes(q),
    );
  }, [items, query]);

  const filtered = useMemo(() => {
    if (!remoteMatches) return localFiltered;
    return items.filter((item) =>
      remoteMatches.has(`${item.type}:${item.slug}`),
    );
  }, [items, localFiltered, remoteMatches]);

  const completedCount = useMemo(() => {
    let count = 0;
    for (const item of items) {
      if (isCompleted(item.type, item.slug)) count += 1;
    }
    return count;
  }, [isCompleted, items]);

  const pct = percent(completedCount, items.length);

  // Debounced remote full-text search (title/summary + content)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setRemoteMatches(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = window.setTimeout(() => {
      void fetch(
        `/api/formation/search?category=${encodeURIComponent(category)}&q=${encodeURIComponent(
          q,
        )}`,
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          const matches: Array<{ type: string; slug: string }> =
            json?.matches ?? [];
          setRemoteMatches(new Set(matches.map((m) => `${m.type}:${m.slug}`)));
        })
        .catch(() => {
          setRemoteMatches(null);
        })
        .finally(() => setIsSearching(false));
    }, 220);

    return () => window.clearTimeout(timer);
  }, [category, query]);

  const list = (mode: "sidebar" | "drawer") => (
    <Card
      className={
        mode === "drawer"
          ? "rounded-none border-0 bg-transparent shadow-none"
          : "flex max-h-[calc(100vh-11rem)] flex-col overflow-hidden rounded-[1.6rem] border-border/80 bg-panel-strong shadow-[0_16px_44px_rgba(15,23,42,0.08)]"
      }
    >
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
          <ProgressBar value={completedCount} max={Math.max(1, items.length)} />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Search size={16} className="text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-10 rounded-2xl"
          />
          {isSearching ? (
            <Badge variant="secondary" className="shrink-0 tabular-nums">
              …
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent
        className={
          mode === "drawer"
            ? "flex flex-col gap-2"
            : "min-h-0 flex-1 overflow-y-auto flex flex-col gap-2 pr-1"
        }
      >
        {filtered.map((item) => {
          const href = `/dashboard/formation/${category}/${item.slug}`;
          const active = pathname === href;
          const done = isCompleted(item.type, item.slug);

          const link = (
            <Link
              key={`${item.type}-${item.slug}`}
              href={href}
              className={`group flex items-start justify-between gap-3 rounded-2xl border px-3 py-2.5 transition-colors ${
                active
                  ? "border-accent/30 bg-accent/10"
                  : "border-border bg-background/40 hover:bg-secondary"
              }`}
              data-testid="formation-category-item"
              onClick={() => {
                if (mode === "drawer") setIsDrawerOpen(false);
              }}
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
                    {item.readTime} min
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
                {item.type === "article" ? (
                  <BookOpen size={16} />
                ) : (
                  <Video size={16} />
                )}
              </span>
            </Link>
          );

          if (mode === "drawer") {
            return (
              <DrawerClose asChild key={`${item.type}-${item.slug}`}>
                {link}
              </DrawerClose>
            );
          }

          return link;
        })}

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-background/30 p-4 text-sm text-muted-foreground">
            {t("noResults")}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <Page className="flex h-full flex-col">
      <FormationProgressSync />
      <div className="sticky top-0 z-20 mb-3 shrink-0 backdrop-blur supports-backdrop-filter:bg-panel-strong/95 sm:mb-4">
        <div className="flex flex-col gap-3 rounded-[1.8rem] border border-border bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--accent)_14%,transparent)_0%,transparent_70%)] px-4 py-4 shadow-[0_14px_40px_rgba(15,23,42,0.08)] sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="rounded-xl">
              <Link href="/dashboard/formation">
                <Home size={16} data-icon="inline-start" />
                {t("label")}
              </Link>
            </Button>
            <ChevronRight size={16} className="text-border" />
            <span className="text-sm font-semibold text-foreground">
              {t(`categories.${category}`)}
            </span>
          </div>
        </div>
      </div>

      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start">
          <aside className="hidden lg:block lg:sticky lg:top-5">
            {list("sidebar")}
          </aside>

          <main className="flex flex-col gap-5">{children}</main>
        </div>
      </PageContent>

      <div className="fixed inset-x-0 bottom-4 z-40 px-4 lg:hidden">
        <div className="pointer-events-none mx-auto w-full max-w-md">
          <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <DrawerTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="pointer-events-auto w-full justify-between rounded-2xl border border-border/80 bg-panel-strong shadow-[0_16px_44px_rgba(15,23,42,0.22)]"
              >
                <span className="inline-flex items-center gap-2">
                  <List size={18} data-icon="inline-start" />
                  {t("contents")}
                </span>
                <Badge variant="secondary" className="tabular-nums">
                  {filtered.length}
                </Badge>
              </Button>
            </DrawerTrigger>
            <DrawerContent className="rounded-t-3xl border-border bg-panel-strong">
              <DrawerHeader>
                <DrawerTitle>{t("contents")}</DrawerTitle>
                <DrawerDescription>
                  {t(`categories.${category}`)} · {completedCount}/
                  {items.length}
                </DrawerDescription>
              </DrawerHeader>
              <div className="min-h-0 overflow-y-auto px-4 pb-6">
                {list("drawer")}
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    </Page>
  );
}
