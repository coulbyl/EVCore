"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, Button, cn } from "@evcore/ui";
import { useTranslations } from "next-intl";

type Announcement = {
  id: string;
  icon?: ReactNode;
  title: string;
  description?: string;
  href: string;
};

export type AnnouncementItem = Announcement;

const DISMISSED_STORAGE_KEY = "evcore:dashboard:announcements:dismissed:v1";

type DismissedStore = {
  ids: string[];
};

function readDismissedIds(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as Partial<DismissedStore>;
    return Array.isArray(parsed.ids)
      ? parsed.ids.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeDismissedIds(ids: string[]): void {
  localStorage.setItem(
    DISMISSED_STORAGE_KEY,
    JSON.stringify({ ids } satisfies DismissedStore),
  );
}

export function Announcements({
  items,
  className,
}: {
  items: Announcement[];
  className?: string;
}) {
  const t = useTranslations("dashboard.announcements");
  const [dismissed, setDismissed] = useState<Record<string, true>>({});

  useEffect(() => {
    const itemIds = new Set(items.map((item) => item.id));
    const cleanedIds = readDismissedIds().filter((id) => itemIds.has(id));
    writeDismissedIds(cleanedIds);

    const next = Object.fromEntries(
      cleanedIds.map((id) => [id, true] as const),
    ) as Record<string, true>;

    setDismissed(next);
  }, [items]);

  const visible = useMemo(
    () => items.filter((item) => !dismissed[item.id]),
    [dismissed, items],
  );

  if (visible.length === 0) return null;

  function dismiss(id: string) {
    const nextIds = Array.from(new Set([...readDismissedIds(), id]));
    writeDismissedIds(nextIds);
    setDismissed((current) => ({ ...current, [id]: true }));
  }

  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center">
        <span>{t("title")}</span>
        <Megaphone size={16} className="inline ml-1" color="blue" />
        <Megaphone size={16} className="inline" color="blue" />
        <Megaphone size={16} className="inline" color="blue" />
      </h2>

      <div className="flex flex-col gap-2">
        {visible.map((news) => (
          <Alert
            key={news.id}
            className="group relative pr-16 transition-colors hover:bg-secondary/35"
          >
            <Link
              href={news.href}
              className="contents"
              onClick={() => dismiss(news.id)}
            >
              <AlertTitle>
                <span className="min-w-0 truncate group-hover:text-accent flex items-center gap-1">
                  {news.icon ? news.icon : null} {news.title}
                </span>
              </AlertTitle>

              {news.description ? (
                <AlertDescription>{news.description}</AlertDescription>
              ) : (
                <AlertDescription />
              )}
            </Link>

            <div className="absolute right-2 top-2 flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-xl text-muted-foreground hover:text-foreground"
                aria-label={t("closeItem")}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  dismiss(news.id);
                }}
              >
                <X />
              </Button>
            </div>
          </Alert>
        ))}
      </div>
    </section>
  );
}
