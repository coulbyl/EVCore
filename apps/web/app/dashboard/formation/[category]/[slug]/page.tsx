import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight, BookOpen, Clock, Video } from "lucide-react";
import { Badge } from "@evcore/ui";
import { MarkdownArticle } from "@/components/markdown-article";
import {
  getFormationContentBySlug,
  getFormationIndex,
} from "@/domains/formation/server/formation-content";
import {
  FORMATION_CATEGORIES,
  type FormationCategory,
} from "@/domains/formation/types/formation";
import { FormationCompletionButton } from "../../components/formation-completion-button";
import { FormationVideoPlayer } from "../../components/formation-video-player";
import { FormationChapters } from "../../components/formation-chapters";
import { FormationRecentTracker } from "../../components/formation-recent-tracker";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { category, slug } = await params;
  const t = await getTranslations("formation");
  if (!FORMATION_CATEGORIES.includes(category as FormationCategory)) {
    return { title: t("label") };
  }

  const article = await getFormationContentBySlug("article", slug);
  const video = article ? null : await getFormationContentBySlug("video", slug);
  const item = article ?? video;
  if (!item) return {};

  return { title: `${t("label")} · ${item.title}` };
}

export default async function FormationCategoryItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { category, slug } = await params;
  if (!FORMATION_CATEGORIES.includes(category as FormationCategory)) notFound();

  const article = await getFormationContentBySlug("article", slug);
  const video = article ? null : await getFormationContentBySlug("video", slug);
  const item = article ?? video;
  if (!item) notFound();
  if (item.category !== (category as FormationCategory)) notFound();

  const { t } = await searchParams;
  const startAtSeconds = t ? Number(t) : 0;

  const tFormation = await getTranslations("formation");

  // Ensure category items exist (layout also fetches) — used only to compute next actions safely.
  const index = await getFormationIndex();
  const categoryItems = index.filter(
    (entry) => entry.category === (category as FormationCategory),
  );
  const currentIndex = categoryItems.findIndex(
    (entry) => entry.slug === item.slug,
  );
  const prevItem = currentIndex > 0 ? categoryItems[currentIndex - 1] : null;
  const nextItem = currentIndex >= 0 ? categoryItems[currentIndex + 1] : null;

  const relatedItems = (() => {
    if (currentIndex < 0) {
      return categoryItems
        .filter((entry) => entry.slug !== item.slug)
        .slice(0, 4);
    }

    const after = categoryItems.slice(currentIndex + 1);
    const before = categoryItems.slice(0, currentIndex).reverse();
    const merged = [...after, ...before].filter(
      (entry) => entry.slug !== item.slug,
    );
    return merged.slice(0, 4);
  })();

  return (
    <section className="flex flex-col gap-5">
      <FormationRecentTracker
        category={category as FormationCategory}
        type={item.type}
        slug={item.slug}
      />
      <header className="flex flex-col gap-4 rounded-[1.8rem] border border-border bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--accent)_16%,transparent)_0%,transparent_70%)] px-4 py-4 shadow-[0_14px_40px_rgba(15,23,42,0.08)] sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h1 className="text-[1.2rem] font-semibold tracking-tight text-foreground sm:text-[1.5rem] lg:text-[2rem]">
              {item.title}
            </h1>
            {item.summary ? (
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                {item.summary}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                {item.type === "article" ? (
                  <BookOpen size={12} />
                ) : (
                  <Video size={12} />
                )}
                {item.type === "article"
                  ? tFormation("article")
                  : tFormation("video")}
              </Badge>
              <Badge variant="secondary">
                {tFormation(`difficulty.${item.difficulty}`)}
              </Badge>
              <Badge variant="outline" className="gap-1 tabular-nums">
                <Clock size={12} />
                {item.type === "video"
                  ? (item.videoDuration ?? `${item.readTime} min`)
                  : `${item.readTime} min`}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <FormationCompletionButton type={item.type} slug={item.slug} />
          </div>
        </div>
      </header>

      {item.type === "video" ? (
        <section className="flex flex-col gap-5">
          <section className="overflow-hidden rounded-[1.6rem] border border-border bg-panel-strong shadow-[0_16px_44px_rgba(15,23,42,0.08)]">
            <div className="p-3 sm:p-4">
              <FormationVideoPlayer
                meta={item}
                startAtSeconds={startAtSeconds}
              />
            </div>
          </section>

          {item.chapters && item.chapters.length > 0 ? (
            <FormationChapters
              chapters={item.chapters}
              currentStart={
                Number.isFinite(startAtSeconds) ? startAtSeconds : 0
              }
            />
          ) : null}

          <section className="overflow-hidden rounded-[1.6rem] border border-border bg-panel-strong shadow-[0_16px_44px_rgba(15,23,42,0.08)]">
            <div className="px-4 py-5 sm:px-6 sm:py-6">
              <div className="mx-auto w-full max-w-3xl">
                <MarkdownArticle content={item.content} />
              </div>
            </div>
          </section>
        </section>
      ) : (
        <section className="overflow-hidden rounded-[1.6rem] border border-border bg-panel-strong shadow-[0_16px_44px_rgba(15,23,42,0.08)]">
          <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-3xl">
              <MarkdownArticle content={item.content} />
            </div>
          </div>
        </section>
      )}

      {prevItem || nextItem || relatedItems.length > 0 ? (
        <section className="rounded-[1.6rem] border border-border bg-panel-strong p-4 shadow-[0_16px_44px_rgba(15,23,42,0.08)] sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {prevItem ? (
              <Link
                href={`/dashboard/formation/${category}/${prevItem.slug}`}
                className="group flex items-start justify-between gap-3 rounded-2xl border border-border bg-background/40 px-3 py-3 transition-colors hover:bg-secondary"
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors group-hover:text-foreground">
                  <ArrowLeft size={16} />
                </span>
                <div className="min-w-0 flex-1 text-right">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    {tFormation("previous")}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">
                    {prevItem.title}
                  </p>
                </div>
              </Link>
            ) : (
              <div className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background/20 px-3 py-3 opacity-60">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground">
                  <ArrowLeft size={16} />
                </span>
                <div className="min-w-0 flex-1 text-right">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    {tFormation("previous")}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-muted-foreground">
                    —
                  </p>
                </div>
              </div>
            )}

            {nextItem ? (
              <Link
                href={`/dashboard/formation/${category}/${nextItem.slug}`}
                className="group flex items-start justify-between gap-3 rounded-2xl border border-border bg-background/40 px-3 py-3 transition-colors hover:bg-secondary"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    {tFormation("next")}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">
                    {nextItem.title}
                  </p>
                </div>
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors group-hover:text-foreground">
                  <ArrowRight size={16} />
                </span>
              </Link>
            ) : (
              <div className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background/20 px-3 py-3 opacity-60">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    {tFormation("next")}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-muted-foreground">
                    —
                  </p>
                </div>
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground">
                  <ArrowRight size={16} />
                </span>
              </div>
            )}
          </div>

          {relatedItems.length > 0 ? (
            <div className="mt-5">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {tFormation("related")}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {relatedItems.map((entry) => (
                  <Link
                    key={`${entry.type}-${entry.slug}`}
                    href={`/dashboard/formation/${category}/${entry.slug}`}
                    className="group flex items-start justify-between gap-3 rounded-2xl border border-border bg-background/40 px-3 py-3 transition-colors hover:bg-secondary"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {entry.title}
                      </p>
                      {entry.summary ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {entry.summary}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="gap-1">
                          {entry.type === "article" ? (
                            <BookOpen size={12} />
                          ) : (
                            <Video size={12} />
                          )}
                          {entry.type === "article"
                            ? tFormation("article")
                            : tFormation("video")}
                        </Badge>
                        <Badge variant="outline" className="gap-1 tabular-nums">
                          <Clock size={12} />
                          {entry.type === "video"
                            ? (entry.videoDuration ?? `${entry.readTime} min`)
                            : `${entry.readTime} min`}
                        </Badge>
                      </div>
                    </div>
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors group-hover:text-foreground">
                      {entry.type === "article" ? (
                        <BookOpen size={16} />
                      ) : (
                        <Video size={16} />
                      )}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
