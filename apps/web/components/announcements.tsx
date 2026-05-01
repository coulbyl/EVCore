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

function storageKey(id: string) {
  return `evcore:dashboard:announcements:dismissed:${id}:v1`;
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
    const next: Record<string, true> = {};
    for (const item of items) {
      if (localStorage.getItem(storageKey(item.id)) === "1") {
        next[item.id] = true;
      }
    }
    setDismissed(next);
  }, [items]);

  const visible = useMemo(
    () => items.filter((item) => !dismissed[item.id]),
    [dismissed, items],
  );

  if (visible.length === 0) return null;

  function dismiss(id: string) {
    localStorage.setItem(storageKey(id), "1");
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
                <AlertDescription>
                  <p className="line-clamp-1">{news.description}</p>
                </AlertDescription>
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
