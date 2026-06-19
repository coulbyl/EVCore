"use client";

import { useLocale } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useChannelDecisionChannels } from "@/domains/channel-decision/use-cases/use-channel-decisions";
import { todayIso } from "@/lib/date";
import { ChannelLens } from "./channel-lens";
import { DecisionsPageFrame } from "./decisions-page-frame";

export function DecisionsChannelsPageClient() {
  const today = todayIso();
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = searchParams.get("date") ?? today;
  const locale = useLocale();
  const { data = [], isLoading, isError } = useChannelDecisionChannels(date);

  function navigateTo(iso: string) {
    const params = new URLSearchParams({ date: iso });
    router.push(`/dashboard/decisions/channels?${params.toString()}`);
  }

  return (
    <DecisionsPageFrame
      contentScroll="child"
      date={date}
      emptyTitle="Aucune sélection"
      emptyDescription="Aucune sélection de canal n'a été retenue pour cette date."
      hasData={data.length > 0}
      isError={isError}
      isLoading={isLoading}
      onDateChange={navigateTo}
    >
      <ChannelLens channelGroups={data} locale={locale} />
    </DecisionsPageFrame>
  );
}
