"use client";

import { ShieldCheck, Target } from "lucide-react";
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
}) {
  const pageOwnsScroll = contentScroll === "page";

  return (
    <Page className="flex h-full flex-col">
      <PageHeader>
        <LensToggle view={view} onChange={onViewChange} />
        <PageHeaderActions>
          <DateNav date={date} onChange={onDateChange} />
        </PageHeaderActions>
      </PageHeader>

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
