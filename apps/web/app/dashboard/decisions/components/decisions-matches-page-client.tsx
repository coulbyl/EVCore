"use client";

import { useLocale } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useChannelDecisionMatches } from "@/domains/channel-decision/use-cases/use-channel-decisions";
import { todayIso } from "@/lib/date";
import { DecisionsPageFrame } from "./decisions-page-frame";
import { MatchLens } from "./match-lens";

export function DecisionsMatchesPageClient() {
  const today = todayIso();
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = searchParams.get("date") ?? today;
  const locale = useLocale();
  const { data = [], isLoading, isError } = useChannelDecisionMatches(date);

  function navigateTo(iso: string) {
    const params = new URLSearchParams({ date: iso });
    router.push(`/dashboard/decisions/matches?${params.toString()}`);
  }

  return (
    <DecisionsPageFrame
      date={date}
      emptyTitle="Aucune décision"
      emptyDescription="Le moteur n'a produit aucune décision de canal pour cette date."
      hasData={data.length > 0}
      isError={isError}
      isLoading={isLoading}
      onDateChange={navigateTo}
    >
      <MatchLens matches={data} locale={locale} />
    </DecisionsPageFrame>
  );
}
