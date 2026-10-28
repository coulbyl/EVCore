"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Page, PageContent, PageHeader, PageHeaderTitle } from "@evcore/ui";
import { useTranslations } from "next-intl";
import { useFormationProgress } from "@/domains/formation/use-cases/use-formation-progress";
import type { FormationContentMeta } from "@/domains/formation/types/formation";
import { sortFormationItems } from "@/domains/formation/helpers/sort-formation-items";

/**
 * Cinq fiches d'une minute, dans l'ordre, et rien d'autre : plus de mise en
 * avant, de catégories, de niveaux ni de vidéo à venir. Les gens ne lisent
 * pas quinze articles de 600 mots écrits pour des initiés (demande du
 * 2026-10-27, docs/audits/2026-10-27/FORMATION.md).
 */
export function FormationPageClient({
  items,
}: {
  items: FormationContentMeta[];
}) {
  const t = useTranslations("formation");
  const { isCompleted } = useFormationProgress();
  const sorted = useMemo(() => sortFormationItems(items), [items]);
  const done = sorted.filter((item) =>
    isCompleted(item.type, item.slug),
  ).length;

  return (
    <Page className="flex h-full flex-col">
      <PageHeader
        data-tour="formation-title"
        className="flex-col items-start gap-1 lg:flex-col lg:items-start lg:justify-start"
      >
        <PageHeaderTitle>{t("title")}</PageHeaderTitle>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          {t("subtitle")}
        </p>
        <p
          data-testid="formation-progress"
          className="text-sm font-medium text-foreground"
        >
          {t("progress", { done, total: sorted.length })}
        </p>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <ol className="mx-auto flex max-w-2xl flex-col divide-y divide-border rounded-2xl border border-border bg-panel">
          {sorted.map((item, index) => {
            const completed = isCompleted(item.type, item.slug);
            return (
              <li key={item.slug}>
                <Link
                  href={`/dashboard/formation/${item.slug}`}
                  data-testid="formation-item"
                  className="flex min-h-16 items-center gap-4 px-4 py-3 transition-colors hover:bg-secondary/60"
                >
                  <span
                    className={
                      completed
                        ? "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success"
                        : "inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-sm font-semibold tabular-nums text-muted-foreground"
                    }
                    aria-label={completed ? t("completed") : undefined}
                  >
                    {completed ? <Check size={16} /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                      {item.title}
                    </span>
                    {item.summary ? (
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        {item.summary}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {t("minutes", { count: item.readTime })}
                  </span>
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            );
          })}
        </ol>
      </PageContent>
    </Page>
  );
}
