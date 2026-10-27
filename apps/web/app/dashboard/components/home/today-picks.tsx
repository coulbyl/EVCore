"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Skeleton } from "@evcore/ui";
import { PickCard } from "@/components/pick-card";
import { AddToCouponButton } from "@/components/add-to-coupon-button";
import { useChannelHealth } from "@/domains/dashboard/use-cases/get-channel-health";
import { useChannelDecisionChannels } from "@/domains/channel-decision/use-cases/use-channel-decisions";
import {
  CHANNEL_COLOR,
  formatOdds,
} from "@/app/dashboard/decisions/components/channel-constants";
import { isExcludedFromDecisions } from "@/app/dashboard/decisions/components/decision-helpers";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import { daysAgoIso, todayIso } from "@/lib/date";
import type { ChannelHealthItem } from "@/domains/dashboard/types/dashboard";
import type { BetSlipDraftItem } from "@/domains/bet-slip/types/bet-slip";
import type {
  ChannelDecisionDto,
  ChannelSelectionDto,
  SelectionResult,
  StrategyChannel,
} from "@/domains/channel-decision/types/channel-decision";

/** Au plus cinq sélections : l'accueil oriente, la page Décisions détaille. */
const MAX_PICKS = 5;
/**
 * Bande de cote où la calibration des sélections tient (audit du
 * 2026-08-22, CLAUDE.md) : en dessous de 1,20 il n'y a rien à jouer, au-dessus
 * de 1,80 le modèle annonce 54 % et réalise 45 %.
 */
// Plafond ramené de 1,80 à 1,65 le 2026-10-12 : sur 90 jours, les sélections
// des canaux fiables réalisent 1,02 / 0,93 / 0,95 de l'annoncé sous 1,35 /
// 1,50 / 1,65, puis 0,83 entre 1,65 et 1,80
// (docs/audits/2026-10-12/MESURES-DECISIONS-COUPONS.md §1).
const ODDS_BAND = { min: 1.2, max: 1.65 } as const;
/** Fenêtre de mesure de la confiance des canaux, la même que Décisions. */
const HEALTH_WINDOW_DAYS = 90;

type TodayPick = {
  key: string;
  decision: ChannelDecisionDto;
  selection: ChannelSelectionDto;
  channel: StrategyChannel;
  status: ChannelHealthItem["status"];
};

function toBetStatus(
  result: SelectionResult | null,
): "WON" | "LOST" | "PENDING" | null {
  return result === "WON" || result === "LOST" || result === "PENDING"
    ? result
    : null;
}

function isUpcoming(decision: ChannelDecisionDto): boolean {
  return (
    decision.score === null &&
    new Date(decision.scheduledAt).getTime() > Date.now()
  );
}

function toDraftItem(pick: TodayPick): BetSlipDraftItem {
  const { decision, selection } = pick;
  return {
    modelRunId: decision.modelRunId,
    fixtureId: decision.fixtureId,
    fixture: `${decision.homeTeam} vs ${decision.awayTeam}`,
    homeLogo: decision.homeLogo,
    awayLogo: decision.awayLogo,
    competition: decision.competitionName ?? decision.competition ?? "",
    scheduledAt: decision.scheduledAt,
    market: selection.market,
    pick: selection.pick,
    odds:
      selection.playableOdds !== null
        ? String(selection.playableOdds)
        : selection.odds !== null
          ? String(selection.odds)
          : null,
    ev: null,
    canal: pick.channel,
    stakeOverride: null,
  };
}

/**
 * Les sélections du jour, choisies par la règle que le projet a mesurée et
 * rien d'autre : un canal dont l'écart réel / annoncé est au plus de 15 % sur
 * 90 jours, une cote dans la bande 1,20–1,80, une sélection par match, les
 * plus probables d'abord, cinq au plus. Chaque pick en une ligne, en langage
 * clair, avec une pastille de confiance et l'ajout au coupon.
 */
export function TodayPicks() {
  const t = useTranslations("dashboard.home");
  const locale = useLocale();
  const marketLocale = locale === "en" ? "en" : "fr";
  const today = todayIso();
  const { data: health = [], isLoading: healthLoading } = useChannelHealth(
    daysAgoIso(HEALTH_WINDOW_DAYS),
    today,
  );
  const { data: groups = [], isLoading: decisionsLoading } =
    useChannelDecisionChannels(today, { status: "SELECTED" });

  const picks = useMemo(() => {
    const statusByChannel = new Map<string, ChannelHealthItem["status"]>(
      health.map((h) => [h.channel, h.status]),
    );
    const byFixture = new Map<string, TodayPick>();
    for (const group of groups) {
      if (isExcludedFromDecisions(group.channel)) continue;
      const status = statusByChannel.get(group.channel);
      if (status !== "GREEN") continue;
      for (const decision of group.decisions) {
        // « Données suspectes » : retiré des coupons, donc de l'accueil aussi
        // (audit du 2026-10-23, P1-8).
        if (decision.calibrationAlert) continue;
        const selection = decision.selections[0];
        if (!selection || selection.odds === null) continue;
        if (selection.odds < ODDS_BAND.min || selection.odds >= ODDS_BAND.max) {
          continue;
        }
        const current = byFixture.get(decision.fixtureId);
        if (current && current.selection.probability >= selection.probability) {
          continue;
        }
        byFixture.set(decision.fixtureId, {
          key: `${decision.fixtureId}:${selection.market}:${selection.pick}`,
          decision,
          selection,
          channel: group.channel,
          status,
        });
      }
    }
    return [...byFixture.values()]
      .sort((a, b) => b.selection.probability - a.selection.probability)
      .slice(0, MAX_PICKS);
  }, [groups, health]);

  const isLoading = healthLoading || decisionsLoading;

  return (
    <section
      data-tour="home-picks"
      className="flex flex-col gap-3"
      aria-labelledby="home-picks-title"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="home-picks-title"
            className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
          >
            {t("picksTitle")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("picksSubtitle")}
          </p>
        </div>
        <Link
          href={`/dashboard/decisions?date=${today}`}
          className="-my-3 flex min-h-11 shrink-0 items-center gap-1 text-xs font-medium text-accent hover:text-accent/80"
        >
          {t("picksLink")} <ArrowRight size={12} />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : picks.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-panel/70 p-6 text-center text-sm text-muted-foreground">
          {t("picksEmpty")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {picks.map((pick) => (
            <PickCard
              key={pick.key}
              homeTeam={pick.decision.homeTeam}
              awayTeam={pick.decision.awayTeam}
              homeLogo={pick.decision.homeLogo}
              awayLogo={pick.decision.awayLogo}
              competition={
                pick.decision.competitionName ?? pick.decision.competition ?? ""
              }
              country={pick.decision.country ?? ""}
              locale={locale}
              scheduledAt={pick.decision.scheduledAt}
              canalColor={CHANNEL_COLOR[pick.channel]}
              marketLabel={formatMarketForDisplay(
                pick.selection.market,
                marketLocale,
              )}
              pickLabel={formatPickForDisplay(
                pick.selection.pick,
                pick.selection.market,
              )}
              probabilityPct={`${Math.round(pick.selection.probability * 100)}%`}
              signalScore={null}
              odds={formatOdds(pick.selection.odds)}
              playable={
                pick.selection.playableOdds !== null &&
                pick.selection.playableBookmaker !== null
                  ? {
                      odds: pick.selection.playableOdds,
                      bookmaker: pick.selection.playableBookmaker,
                    }
                  : null
              }
              score={pick.decision.score}
              htScore={pick.decision.htScore}
              betStatus={toBetStatus(pick.selection.result)}
              actionSlot={
                // Plus de badge « Fiable » : le bloc ne garde que des canaux
                // fiables, il valait « Fiable » cinq fois sur cinq (revue UX
                // du 2026-10-24, P2 n°5) ; la règle est dans le sous-titre.
                isUpcoming(pick.decision) ? (
                  <AddToCouponButton item={toDraftItem(pick)} />
                ) : null
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
