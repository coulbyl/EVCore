import { useState } from "react";
import { Ban, ChevronDown, ChevronUp, TriangleAlert } from "lucide-react";
import { Separator, cn } from "@evcore/ui";
import { useLocale, useTranslations } from "next-intl";
import { InfoTooltip } from "@/components/info-tooltip";
import { FixtureCard } from "@/components/fixture-card";
import { NewCoachChip } from "@/components/new-coach-badge";
import { LegConnector } from "@/components/leg-connector";
import type {
  ChannelDecisionMatchDto,
  StrategyChannel,
} from "@/domains/channel-decision/types/channel-decision";
import {
  channelLabel,
  reasonLabel,
  type ChannelCalibrationByKey,
} from "./channel-constants";
import { avoidFlag, selectedPicks, type AvoidFlag } from "./decision-helpers";
import { ChannelRow, type SlipContext } from "./channel-row";

export type MatchGroup = ChannelDecisionMatchDto;

// Cards capped to a handful of picks, sorted by confidence (selectedPicks
// already sorts by probability desc) — a 9-pick card reads as a data dump,
// not a read (docs/vantage-centric-redesign-2026-09-01.md §2).
const MAX_VISIBLE_PICKS = 4;

export function MatchCard({
  group,
  locale,
  calibrationByKey,
}: {
  group: MatchGroup;
  locale: string;
  calibrationByKey?: ChannelCalibrationByKey;
}) {
  const t = useTranslations("decisions");
  const [expanded, setExpanded] = useState(false);
  const avoid = avoidFlag(group);
  const picks = selectedPicks(group);
  const visiblePicks = expanded ? picks : picks.slice(0, MAX_VISIBLE_PICKS);
  const hiddenCount = picks.length - visiblePicks.length;
  const calibrationAlert = group.decisions.some((d) => d.calibrationAlert);

  const avoidEdgeByChannel = new Map<StrategyChannel, number>(
    avoid?.offenders.map((o) => [o.channel, o.edge]) ?? [],
  );

  // Pariable uniquement avant le coup d'envoi : pas de match en cours ni terminé.
  const isUpcoming =
    group.score === null && new Date(group.scheduledAt).getTime() > Date.now();

  const slipContext: SlipContext | undefined = isUpcoming
    ? {
        fixtureId: group.fixtureId,
        fixture: `${group.homeTeam} vs ${group.awayTeam}`,
        homeLogo: group.homeLogo,
        awayLogo: group.awayLogo,
        competition: group.competition,
        scheduledAt: group.scheduledAt,
      }
    : undefined;

  const banners = (avoid || calibrationAlert) && (
    <div className="flex flex-col gap-2 px-3 pt-3">
      {avoid && (
        <div
          className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
          style={{
            color: "var(--canal-avoid)",
            backgroundColor: "var(--canal-avoid-soft)",
            borderColor:
              "color-mix(in srgb, var(--canal-avoid) 35%, transparent)",
          }}
        >
          <Ban className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t("avoid.banner")}</span>
            <AvoidOffenderLine avoid={avoid} />
          </span>
          <InfoTooltip
            label={t("avoid.tooltipLabel")}
            description={t("avoid.tooltipDetail")}
            side="left"
          />
        </div>
      )}

      {calibrationAlert && (
        <div
          className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
          style={{
            color: "var(--canal-avoid)",
            backgroundColor: "var(--canal-avoid-soft)",
            borderColor:
              "color-mix(in srgb, var(--canal-avoid) 35%, transparent)",
          }}
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {t("calibration.banner")}
            </span>
          </span>
          <InfoTooltip
            label={t("calibration.tooltipLabel")}
            description={t("calibration.tooltipDetail")}
            side="left"
          />
        </div>
      )}
    </div>
  );

  return (
    <FixtureCard
      fixture={`${group.homeTeam} vs ${group.awayTeam}`}
      homeLogo={group.homeLogo}
      awayLogo={group.awayLogo}
      competition={group.competitionName}
      country={group.country}
      kickoff={group.kickoff}
      score={group.score}
      htScore={group.htScore}
      status={group.fixtureStatus}
      locale={locale}
      homeBadge={
        group.homeNewCoach ? <NewCoachChip locale={locale} /> : undefined
      }
      awayBadge={
        group.awayNewCoach ? <NewCoachChip locale={locale} /> : undefined
      }
      className={cn(
        "transition-colors hover:border-border",
        avoid && "border-[color:var(--canal-avoid)]/40",
      )}
      beforeHeader={banners}
      bodyClassName="flex flex-col gap-2 py-3"
    >
      <Separator />

      {picks.length > 0 ? (
        <div className="flex flex-col">
          {visiblePicks.map((decision, idx) => (
            <div key={decision.id} className="flex">
              {visiblePicks.length > 1 && (
                <LegConnector isLast={idx === visiblePicks.length - 1} />
              )}
              <div className="min-w-0 flex-1 border-t border-border/50 first:border-t-0">
                <ChannelRow
                  channel={decision.channel}
                  decision={decision}
                  locale={locale}
                  avoidEdge={avoidEdgeByChannel.get(decision.channel)}
                  slipContext={slipContext}
                  competitionCode={group.competition}
                  calibrationByKey={calibrationByKey}
                />
              </div>
            </div>
          ))}
          {picks.length > MAX_VISIBLE_PICKS && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="flex items-center justify-center gap-1 border-t border-border/50 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <>
                  {t("showLessPicks")}
                  <ChevronUp className="size-3.5" />
                </>
              ) : (
                <>
                  {t("showMorePicks", { count: hiddenCount })}
                  <ChevronDown className="size-3.5" />
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <p className="py-1 text-xs text-muted-foreground/70">{t("noPick")}</p>
      )}
    </FixtureCard>
  );
}

function AvoidOffenderLine({ avoid }: { avoid: AvoidFlag }) {
  const t = useTranslations("decisions");
  const locale = useLocale();
  const first = avoid.offenders[0];
  if (first) {
    const edgePct = `+${Math.round(first.edge * 100)}%`;
    return (
      <span className="block leading-snug opacity-90">
        {channelLabel(first.channel, locale)} · {t("avoid.edge")} {edgePct}
      </span>
    );
  }
  const fallback = reasonLabel(avoid.reasonCode, t);
  return fallback ? (
    <span className="block leading-snug opacity-90">{fallback}</span>
  ) : null;
}
