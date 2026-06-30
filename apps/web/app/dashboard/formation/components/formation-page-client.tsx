"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  GraduationCap,
  ListVideo,
  PlayCircle,
  Shield,
  Shapes,
  Sparkles,
  Trophy,
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
import { useFormationProgress } from "@/domains/formation/use-cases/use-formation-progress";
import type {
  FormationCategory,
  FormationContentMeta,
} from "@/domains/formation/types/formation";

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
      return <Trophy size={16} />;
    case "app":
      return <GraduationCap size={16} />;
  }
}

function videoDuration(item: FormationContentMeta): string {
  return item.videoDuration ?? `${item.readTime} min`;
}

export function FormationPageClient({
  items,
}: {
  items: FormationContentMeta[];
}) {
  const t = useTranslations("formation");
  const { isCompleted, progress } = useFormationProgress();

  const videos = useMemo(
    () =>
      items
        .filter((item) => item.type === "video")
        .slice()
        .sort((a, b) => {
          const ao = a.order ?? Number.POSITIVE_INFINITY;
          const bo = b.order ?? Number.POSITIVE_INFINITY;
          if (ao !== bo) return ao - bo;
          return a.title.localeCompare(b.title);
        }),
    [items],
  );

  const videoBySlug = useMemo(
    () => new Map(videos.map((item) => [item.slug, item])),
    [videos],
  );

  const completedVideos = useMemo(
    () => countCompleted(videos, isCompleted),
    [isCompleted, videos],
  );
  const totalPercent = percent(completedVideos, videos.length);

  const recentVideo = useMemo(() => {
    const recent = progress.recent;
    if (!recent || recent.type !== "video") return null;
    return videoBySlug.get(recent.slug) ?? null;
  }, [progress.recent, videoBySlug]);

  const featuredVideo = recentVideo ?? videos[0] ?? null;

  const otherVideos = useMemo(
    () => videos.filter((video) => video.slug !== featuredVideo?.slug),
    [videos, featuredVideo],
  );

  return (
    <Page className="flex h-full flex-col">
      <PageHeader className="lg:flex-col lg:items-stretch lg:justify-start">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-11 items-center justify-center rounded-2xl border border-border bg-secondary text-accent shadow-xs">
                <Video size={18} />
              </span>
              <div className="min-w-0">
                <PageHeaderTitle className="truncate text-[1.2rem] font-semibold tracking-tight sm:text-[1.55rem]">
                  {t("videoHub.title")}
                </PageHeaderTitle>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {t("videoHub.subtitle")}
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
                {completedVideos} / {Math.max(1, videos.length)}
              </p>
            </div>
            <div className="mt-2">
              <ProgressBar
                value={completedVideos}
                max={Math.max(1, videos.length)}
                showValue={false}
              />
            </div>
            <p className="mt-2 text-xs tabular-nums text-muted-foreground">
              {totalPercent}% · {t("videoHub.videoOnly")}
            </p>
          </div>
        </div>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-5">
          {featuredVideo ? (
            <section className="overflow-hidden rounded-[1.6rem] border border-border bg-panel-strong ev-shell-shadow">
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
                <Link
                  href={`/dashboard/formation/${featuredVideo.category}/${featuredVideo.slug}`}
                  className="group relative flex min-h-[15rem] flex-col justify-end overflow-hidden bg-secondary p-5 sm:min-h-[19rem] sm:p-6"
                  data-testid="formation-category-link"
                >
                  <div className="absolute inset-0 border-b border-border bg-background/20" />
                  <div className="absolute inset-x-5 top-5 flex items-center justify-between gap-3">
                    <Badge variant="accent" className="gap-1">
                      <PlayCircle size={12} />
                      {recentVideo ? t("continue") : t("recommended")}
                    </Badge>
                    <Badge variant="secondary" className="gap-1 tabular-nums">
                      <Clock size={12} />
                      {videoDuration(featuredVideo)}
                    </Badge>
                  </div>

                  <div className="relative max-w-2xl">
                    <span className="mb-4 inline-flex size-14 items-center justify-center rounded-full border border-border bg-background/80 text-accent shadow-xs transition-transform group-hover:scale-105">
                      <PlayCircle size={24} />
                    </span>
                    <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                      {featuredVideo.title}
                    </h2>
                    {featuredVideo.summary ? (
                      <p className="mt-2 line-clamp-2 max-w-xl text-sm leading-6 text-muted-foreground">
                        {featuredVideo.summary}
                      </p>
                    ) : null}
                  </div>
                </Link>

                <div className="flex flex-col justify-between gap-5 border-t border-border p-5 lg:border-l lg:border-t-0">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {t(`categories.${featuredVideo.category}`)}
                      </Badge>
                      <Badge variant="outline">
                        {t(`difficulty.${featuredVideo.difficulty}`)}
                      </Badge>
                      {isCompleted(featuredVideo.type, featuredVideo.slug) ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 size={12} />
                          {t("completed")}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {t("videoHub.featuredCopy")}
                    </p>
                  </div>

                  <Button asChild className="w-full rounded-xl sm:w-fit">
                    <Link
                      href={`/dashboard/formation/${featuredVideo.category}/${featuredVideo.slug}`}
                    >
                      {recentVideo ? t("continue") : t("videoHub.watchNow")}
                      <ChevronRight data-icon="inline-end" />
                    </Link>
                  </Button>
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-11 items-center justify-center rounded-2xl border border-border bg-secondary text-accent">
                  <ListVideo size={18} />
                </span>
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {t("videoHub.emptyTitle")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("videoHub.emptySubtitle")}
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <MetricCard
              label={t("videoHub.metrics.available")}
              value={String(videos.length)}
              icon={<Video size={16} />}
            />
            <MetricCard
              label={t("videoHub.metrics.completed")}
              value={`${completedVideos}/${Math.max(1, videos.length)}`}
              icon={<CheckCircle2 size={16} />}
            />
            <MetricCard
              label={t("videoHub.metrics.next")}
              value={featuredVideo ? videoDuration(featuredVideo) : "0 min"}
              icon={<Clock size={16} />}
            />
          </section>

          {otherVideos.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                {t("library")}
              </h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {otherVideos.map((video) => (
                  <AvailableVideoCard
                    key={video.slug}
                    video={video}
                    completed={isCompleted(video.type, video.slug)}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </PageContent>
    </Page>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[1.2rem] border border-border bg-panel-strong p-4 ev-shell-shadow">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
            {value}
          </p>
        </div>
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary text-accent">
          {icon}
        </span>
      </div>
    </div>
  );
}

function AvailableVideoCard({
  video,
  completed,
}: {
  video: FormationContentMeta;
  completed: boolean;
}) {
  const t = useTranslations("formation");

  return (
    <Link
      href={`/dashboard/formation/${video.category}/${video.slug}`}
      className="bento-cell-interactive group flex min-h-[12.5rem] flex-col justify-between gap-4 p-4"
      data-testid="formation-category-item"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary text-accent transition-transform group-hover:scale-105">
          <PlayCircle size={20} />
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
            {videoDuration(video)}
          </Badge>
        </div>
      </div>

      <div className="min-w-0">
        <p className="line-clamp-2 text-base font-semibold tracking-tight text-foreground">
          {video.title}
        </p>
        {video.summary ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {video.summary}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Badge variant="outline" className="gap-1">
          {categoryIcon(video.category)}
          {t(`categories.${video.category}`)}
        </Badge>
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors group-hover:text-foreground">
          <ChevronRight size={16} />
        </span>
      </div>
    </Link>
  );
}
