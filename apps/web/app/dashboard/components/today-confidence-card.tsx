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
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
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

type CalibrationLevel = "CLOSE" | "MODERATE_GAP" | "LARGE_GAP" | "UNKNOWN";

const CALIBRATION_BADGE_VARIANT: Record<
  CalibrationLevel,
  "outline" | "warning" | "destructive" | "neutral"
> = {
  CLOSE: "outline",
  MODERATE_GAP: "warning",
  LARGE_GAP: "destructive",
  UNKNOWN: "neutral",
};

type CalibrationBandPick = {
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
// each channel's calibration status (dashboard/channel-health). The visible
// labels describe measured deviation bands and never turn them into a betting
// recommendation.
export function TodayCalibrationCard({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
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

  const { calibrationLevel, lowGapPicks, highGapChannels } = useMemo(() => {
    let sawGreen = false;
    let sawRed = false;
    let sawAny = false;
    const picksWithin15: CalibrationBandPick[] = [];
    const seenFixtures = new Set<string>();
    const channelsAbove30: StrategyChannel[] = [];

    for (const group of channelGroups) {
      const status: ChannelHealthItem["status"] | undefined =
        healthByChannel.get(group.channel)?.status;
      if (status === "GREEN" || status === "ORANGE" || status === "RED") {
        sawAny = true;
      }
      if (status === "RED") {
        sawRed = true;
        channelsAbove30.push(group.channel);
      }
      if (status === "GREEN") {
        sawGreen = true;
        for (const decision of group.decisions) {
          if (seenFixtures.has(decision.fixtureId)) continue;
          const selection = decision.selections[0];
          if (!selection) continue;
          seenFixtures.add(decision.fixtureId);
          picksWithin15.push({
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

    const level: CalibrationLevel = !sawAny
      ? "UNKNOWN"
      : sawRed
        ? "LARGE_GAP"
        : sawGreen
          ? "CLOSE"
          : "MODERATE_GAP";

    return {
      calibrationLevel: level,
      lowGapPicks: picksWithin15.slice(0, MAX_PICKS_SHOWN),
      highGapChannels: channelsAbove30,
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
          <Badge variant={CALIBRATION_BADGE_VARIANT[calibrationLevel]}>
            {t(
              calibrationLevel === "CLOSE"
                ? "confidenceHigh"
                : calibrationLevel === "MODERATE_GAP"
                  ? "confidenceModerate"
                  : calibrationLevel === "LARGE_GAP"
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
        ) : lowGapPicks.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("emptyFollow")}
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {lowGapPicks.map((pick) => (
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
        ) : highGapChannels.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("emptyAvoid")}
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {highGapChannels.map((channel) => (
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
