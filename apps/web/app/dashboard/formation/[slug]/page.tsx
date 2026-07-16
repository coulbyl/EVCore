import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight, Clock, FileText, Video } from "lucide-react";
import {
  Badge,
  Page,
  PageContent,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
  ProgressBar,
} from "@evcore/ui";
import { MarkdownArticle } from "@/components/markdown-article";
import {
  getFormationContentBySlug,
  getFormationIndex,
} from "@/domains/formation/server/formation-content";
import { FormationCompletionButton } from "../components/formation-completion-button";
import { FormationVideoPlayer } from "../components/formation-video-player";
import { FormationChapters } from "../components/formation-chapters";
import { FormationRecentTracker } from "../components/formation-recent-tracker";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations("formation");
  const item = await getFormationContentBySlug(slug);
  if (!item) return { title: t("label") };
  return { title: `${t("label")} · ${item.title}` };
}

export default async function FormationLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const item = await getFormationContentBySlug(slug);
  if (!item) notFound();

  const { t: startParam } = await searchParams;
  const startAtSeconds = startParam ? Number(startParam) : 0;

  const tFormation = await getTranslations("formation");

  const index = await getFormationIndex();
  const categoryItems = index
    .filter((entry) => entry.category === item.category)
    .slice()
    .sort((a, b) => {
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return a.title.localeCompare(b.title);
    });
  const currentIndex = categoryItems.findIndex(
    (entry) => entry.slug === item.slug,
  );
  const prevItem = currentIndex > 0 ? categoryItems[currentIndex - 1] : null;
  const nextItem = currentIndex >= 0 ? categoryItems[currentIndex + 1] : null;
  const categoryCompletedHint = `${currentIndex + 1}/${categoryItems.length}`;

  const relatedItems = (item.related ?? [])
    .map((relatedSlug) => index.find((entry) => entry.slug === relatedSlug))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .slice(0, 4);

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <FormationRecentTracker
            category={item.category}
            type={item.type}
            slug={item.slug}
          />

          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link
              href="/dashboard/formation"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <ArrowLeft size={12} />
              {tFormation("label")}
            </Link>
            <span className="opacity-40">/</span>
            <span className="truncate text-foreground">{item.title}</span>
            <span className="ml-auto shrink-0 tabular-nums">
              {tFormation(`categories.${item.category}`)} · {categoryCompletedHint}
            </span>
          </nav>

          <PageHeader className="flex-col gap-4 bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--accent)_16%,transparent)_0%,transparent_70%)] px-4 py-4 shadow-[0_14px_40px_rgba(15,23,42,0.08)] sm:px-6 sm:py-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <PageHeaderTitle className="text-[1.15rem] font-semibold tracking-tight sm:text-[1.4rem]">
                  {item.title}
                </PageHeaderTitle>
                {item.summary ? (
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {item.summary}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    {item.type === "video" ? (
                      <Video size={12} />
                    ) : (
                      <FileText size={12} />
                    )}
                    {tFormation(item.type === "video" ? "video" : "article")}
                  </Badge>
                  <Badge variant="secondary">
                    {tFormation(`difficulty.${item.difficulty}`)}
                  </Badge>
                  <Badge variant="outline" className="gap-1 tabular-nums">
                    <Clock size={12} />
                    {item.videoDuration ?? `${item.readTime} min`}
                  </Badge>
                </div>
              </div>

              <PageHeaderActions className="flex items-center justify-end gap-2">
                <FormationCompletionButton type={item.type} slug={item.slug} />
              </PageHeaderActions>
            </div>
          </PageHeader>

          {item.videoUrl ? (
            <section className="overflow-hidden rounded-[1.6rem] border border-border bg-panel-strong shadow-[0_16px_44px_rgba(15,23,42,0.08)]">
              <div className="p-3 sm:p-4">
                <FormationVideoPlayer
                  meta={item}
                  startAtSeconds={startAtSeconds}
                />
              </div>
            </section>
          ) : null}

          {item.chapters && item.chapters.length > 0 ? (
            <FormationChapters
              chapters={item.chapters}
              currentStart={Number.isFinite(startAtSeconds) ? startAtSeconds : 0}
            />
          ) : null}

          <section className="overflow-hidden rounded-[1.6rem] border border-border bg-panel-strong shadow-[0_16px_44px_rgba(15,23,42,0.08)]">
            <div className="px-4 py-5 sm:px-6 sm:py-6">
              <MarkdownArticle content={item.content} />
            </div>
          </section>

          <div className="flex items-center gap-2">
            <ProgressBar
              value={currentIndex + 1}
              max={Math.max(1, categoryItems.length)}
              showValue={false}
            />
          </div>

          {prevItem || nextItem || relatedItems.length > 0 ? (
            <section className="rounded-[1.6rem] border border-border bg-panel-strong p-4 shadow-[0_16px_44px_rgba(15,23,42,0.08)] sm:p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {prevItem ? (
                  <Link
                    href={`/dashboard/formation/${prevItem.slug}`}
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
                    href={`/dashboard/formation/${nextItem.slug}`}
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
                        href={`/dashboard/formation/${entry.slug}`}
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
                              {entry.type === "video" ? (
                                <Video size={12} />
                              ) : (
                                <FileText size={12} />
                              )}
                              {tFormation(
                                entry.type === "video" ? "video" : "article",
                              )}
                            </Badge>
                            <Badge variant="outline" className="gap-1 tabular-nums">
                              <Clock size={12} />
                              {entry.videoDuration ?? `${entry.readTime} min`}
                            </Badge>
                          </div>
                        </div>
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors group-hover:text-foreground">
                          {entry.type === "video" ? (
                            <Video size={16} />
                          ) : (
                            <FileText size={16} />
                          )}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </PageContent>
    </Page>
  );
}
