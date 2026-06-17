"use client";

import { LayoutGrid, ListFilter, ShieldCheck, Target } from "lucide-react";
import {
  Page,
  PageHeader,
  PageHeaderActions,
  PageContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Skeleton,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@evcore/ui";
import { useLocale } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useChannelDecisions } from "@/domains/channel-decision/use-cases/use-channel-decisions";
import { todayIso } from "@/lib/date";
import { DateNav } from "@/components/date-nav";
import { MatchLens } from "./match-lens";
import { ChannelLens } from "./channel-lens";

export function DecisionsPageClient() {
  const today = todayIso();
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = searchParams.get("date") ?? today;
  const locale = useLocale();
  const { data, isLoading, isError } = useChannelDecisions(date);

  const decisions = data ?? [];
  const hasDecisions = decisions.length > 0;

  function navigateTo(iso: string) {
    const params = new URLSearchParams({ date: iso });
    router.push(`/dashboard/decisions?${params.toString()}`);
  }

  return (
    <Page className="flex h-full flex-col">
      <PageHeader>
        <div />
        <PageHeaderActions>
          <DateNav date={date} onChange={navigateTo} />
        </PageHeaderActions>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-hidden p-4 sm:p-5 ev-shell-shadow">
        <div className="min-h-0 flex-1 overflow-y-auto">
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

          {!isLoading && !isError && !hasDecisions && (
            <Empty className="rounded-[1.6rem] border-border bg-background/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Target className="size-5" />
                </EmptyMedia>
                <EmptyTitle>Aucune décision</EmptyTitle>
                <EmptyDescription>
                  Le moteur n&apos;a produit aucune décision de canal pour cette
                  date.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {!isLoading && !isError && hasDecisions && (
            <Tabs defaultValue="match" className="flex flex-col gap-4">
              <TabsList variant="line">
                <TabsTrigger value="match">
                  <LayoutGrid className="size-3.5" />
                  Par match
                </TabsTrigger>
                <TabsTrigger value="channel">
                  <ListFilter className="size-3.5" />
                  Par canal
                </TabsTrigger>
              </TabsList>

              <TabsContent value="match">
                <MatchLens decisions={decisions} locale={locale} />
              </TabsContent>
              <TabsContent value="channel">
                <ChannelLens decisions={decisions} locale={locale} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </PageContent>
    </Page>
  );
}
