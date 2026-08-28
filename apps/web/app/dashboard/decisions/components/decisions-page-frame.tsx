"use client";

import { ShieldCheck, Target } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Page,
  PageContent,
  PageHeader,
  PageHeaderActions,
  Skeleton,
} from "@evcore/ui";
import { DateNav } from "@/components/date-nav";
import { FormationHelpLink } from "@/components/formation-help-link";
import { LensToggle, type DecisionsView } from "./lens-toggle";

export function DecisionsPageFrame({
  children,
  contentScroll = "page",
  date,
  emptyDescription,
  emptyTitle,
  hasData,
  isError,
  isLoading,
  onDateChange,
  view,
  onViewChange,
  headerExtra,
  subHeader,
  leagueFilter,
}: {
  children: React.ReactNode;
  contentScroll?: "page" | "child";
  date: string;
  emptyDescription: string;
  emptyTitle: string;
  hasData: boolean;
  isError: boolean;
  isLoading: boolean;
  onDateChange: (iso: string) => void;
  view: DecisionsView;
  onViewChange: (view: DecisionsView) => void;
  // A compact control (e.g. the FiltersPopover collapsing "only picks" +
  // group-by) inlined next to DateNav in the header row — same level as
  // Investir's filters, instead of a separate boxed row below.
  headerExtra?: React.ReactNode;
  // Wider content (e.g. the channel tab strip) that needs its own row —
  // kept as a distinct boxed panel below the header.
  subHeader?: React.ReactNode;
  // Championship chips, above everything else — shared by both lenses
  // (Par match / Par canal), so it renders once here rather than inside
  // either lens's own header slot.
  leagueFilter?: React.ReactNode;
}) {
  const t = useTranslations("decisions");
  const pageOwnsScroll = contentScroll === "page";

  return (
    <Page className="flex h-full flex-col">
      {leagueFilter ? (
        <div className="mb-3 shrink-0">{leagueFilter}</div>
      ) : null}
      <PageHeader>
        <LensToggle view={view} onChange={onViewChange} />
        <PageHeaderActions className="w-full lg:w-auto">
          {headerExtra}
          <DateNav date={date} onChange={onDateChange} className="flex-1" />
          <FormationHelpLink
            slug="comment-lire-un-pick"
            label={t("helpLink")}
            tourId="decisions-help"
          />
        </PageHeaderActions>
      </PageHeader>

      {subHeader ? (
        <div className="mb-4 shrink-0 border border-border bg-panel-strong p-4 sm:mb-5">
          {subHeader}
        </div>
      ) : null}

      <PageContent
        className={`min-h-0 flex-1 p-4 sm:p-5 ev-shell-shadow ${
          pageOwnsScroll ? "overflow-y-auto" : "overflow-hidden"
        }`}
      >
        <div
          className={
            pageOwnsScroll ? "min-h-full" : "flex h-full min-h-0 flex-col"
          }
        >
          {isLoading && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-2xl" />
              ))}
            </div>
          )}

          {isError && (
            <Empty className="rounded-[1.6rem] border-border bg-background/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShieldCheck className="size-5" />
                </EmptyMedia>
                <EmptyTitle>Chargement impossible</EmptyTitle>
                <EmptyDescription>
                  Erreur de chargement. Réessayez plus tard.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {!isLoading && !isError && !hasData && (
            <Empty className="rounded-[1.6rem] border-border bg-background/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Target className="size-5" />
                </EmptyMedia>
                <EmptyTitle>{emptyTitle}</EmptyTitle>
                <EmptyDescription>{emptyDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {!isLoading && !isError && hasData && children}
        </div>
      </PageContent>
    </Page>
  );
}
