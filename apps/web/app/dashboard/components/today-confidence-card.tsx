"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@evcore/ui";
import { PickCard } from "@/components/pick-card";
import { useChannelHealth } from "@/domains/dashboard/use-cases/get-channel-health";
import { useChannelDecisionChannels } from "@/domains/channel-decision/use-cases/use-channel-decisions";
import {
  channelLabel,
  CHANNEL_COLOR,
} from "@/app/dashboard/decisions/components/channel-constants";
import { formatMarketForDisplay, formatPickForDisplay } from "@/helpers/fixture";
import type { ChannelHealthItem } from "@/domains/dashboard/types/dashboard";
import type {
  SelectionResult,
  StrategyChannel,
} from "@/domains/channel-decision/types/channel-decision";

const MAX_PICKS_SHOWN = 3;

// SelectionResult carries VOID (refunded selection) — PickCard's ResultBadge
// only knows WON/LOST/PENDING, so a void pick shows no verdict rather than a
// wrong one.
function toBetStatus(
  result: SelectionResult | null,
): "WON" | "LOST" | "PENDING" | null {
  return result === "WON" || result === "LOST" || result === "PENDING"
    ? result
    : null;
}

type Confidence = "HIGH" | "MODERATE" | "LOW" | "UNKNOWN";

const CONFIDENCE_BADGE_VARIANT: Record<
  Confidence,
  "success" | "warning" | "destructive" | "neutral"
> = {
  HIGH: "success",
  MODERATE: "warning",
  LOW: "destructive",
  UNKNOWN: "neutral",
};

type FollowPick = {
  key: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string;
  country: string;
  scheduledAt: string;
  score: string | null;
  htScore: string | null;
  channel: StrategyChannel;
  marketLabel: string;
  pickLabel: string;
  probabilityPct: string;
  betStatus: "WON" | "LOST" | "PENDING" | null;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Cross-references today's SELECTED picks (channel-decisions/by-channel) with
// each channel's calibration status (dashboard/channel-health, same GREEN/
// ORANGE/RED already used by ChannelStatusStrip) — never a raw ratio shown
// here, only the derived confidence badge and the two plain-language lists,
// per docs/dashboard-operator-admin-redesign-2026-09-04.md étape 1.
export function TodayConfidenceCard({ from, to }: { from: string; to: string }) {
  const t = useTranslations("dashboard.todayConfidence");
  const locale = useLocale();
  const marketLocale = locale === "en" ? "en" : "fr";
  const { data: health = [], isLoading: healthLoading } = useChannelHealth(
    from,
    to,
  );
  const { data: channelGroups = [], isLoading: decisionsLoading } =
    useChannelDecisionChannels(todayIso(), { status: "SELECTED" });

  const healthByChannel = useMemo(
    () => new Map<string, ChannelHealthItem>(health.map((h) => [h.channel, h])),
    [health],
  );

  const { confidence, toFollow, toAvoid } = useMemo(() => {
    let sawGreen = false;
    let sawRed = false;
    let sawAny = false;
    const follow: FollowPick[] = [];
    const seenFixtures = new Set<string>();
    const avoidChannels: StrategyChannel[] = [];

    for (const group of channelGroups) {
      const status: ChannelHealthItem["status"] | undefined =
        healthByChannel.get(group.channel)?.status;
      if (status === "GREEN" || status === "ORANGE" || status === "RED") {
        sawAny = true;
      }
      if (status === "RED") {
        sawRed = true;
        avoidChannels.push(group.channel);
      }
      if (status === "GREEN") {
        sawGreen = true;
        for (const decision of group.decisions) {
          if (seenFixtures.has(decision.fixtureId)) continue;
          const selection = decision.selections[0];
          if (!selection) continue;
          seenFixtures.add(decision.fixtureId);
          follow.push({
            key: decision.fixtureId,
            homeTeam: decision.homeTeam,
            awayTeam: decision.awayTeam,
            homeLogo: decision.homeLogo,
            awayLogo: decision.awayLogo,
            competition: decision.competitionName ?? decision.competition ?? "",
            country: decision.country ?? "",
            scheduledAt: decision.scheduledAt,
            score: decision.score,
            htScore: decision.htScore,
            channel: group.channel,
            marketLabel: formatMarketForDisplay(selection.market, marketLocale),
            pickLabel: formatPickForDisplay(selection.pick, selection.market),
            probabilityPct: `${Math.round(selection.probability * 100)}%`,
            betStatus: toBetStatus(selection.result),
          });
        }
      }
    }

    const level: Confidence = !sawAny
      ? "UNKNOWN"
      : sawRed
        ? "LOW"
        : sawGreen
          ? "HIGH"
          : "MODERATE";

    return {
      confidence: level,
      toFollow: follow.slice(0, MAX_PICKS_SHOWN),
      toAvoid: avoidChannels,
    };
  }, [channelGroups, healthByChannel, marketLocale]);

  const isLoading = healthLoading || decisionsLoading;

  return (
    <section className="ev-shell-shadow rounded-[1.6rem] border border-border bg-panel-strong p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {t("headline")}
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
            {t("title")}
          </h2>
        </div>
        {isLoading ? (
          <div className="h-6 w-32 animate-pulse rounded-full bg-secondary" />
        ) : (
          <Badge variant={CONFIDENCE_BADGE_VARIANT[confidence]}>
            {t(
              confidence === "HIGH"
                ? "confidenceHigh"
                : confidence === "MODERATE"
                  ? "confidenceModerate"
                  : confidence === "LOW"
                    ? "confidenceLow"
                    : "confidenceUnknown",
            )}
          </Badge>
        )}
      </div>

      <div className="mt-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {t("toFollow")}
        </p>
        {isLoading ? (
          <div className="mt-2 flex flex-col gap-2">
            <div className="h-20 animate-pulse rounded-xl bg-secondary" />
            <div className="h-20 animate-pulse rounded-xl bg-secondary" />
          </div>
        ) : toFollow.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("emptyFollow")}
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {toFollow.map((pick) => (
              <PickCard
                key={pick.key}
                homeTeam={pick.homeTeam}
                awayTeam={pick.awayTeam}
                homeLogo={pick.homeLogo}
                awayLogo={pick.awayLogo}
                competition={pick.competition}
                country={pick.country}
                locale={locale}
                scheduledAt={pick.scheduledAt}
                canalColor={CHANNEL_COLOR[pick.channel]}
                marketLabel={pick.marketLabel}
                pickLabel={pick.pickLabel}
                probabilityPct={pick.probabilityPct}
                signalScore={null}
                odds={null}
                score={pick.score}
                htScore={pick.htScore}
                betStatus={pick.betStatus}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-panel p-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {t("toAvoid")}
        </p>
        {isLoading ? (
          <div className="mt-2 h-8 animate-pulse rounded-lg bg-secondary" />
        ) : toAvoid.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("emptyAvoid")}
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {toAvoid.map((channel) => (
              <Badge key={channel} variant="destructive">
                {channelLabel(channel, locale)}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
