"use client";

import { useState } from "react";
import * as HoverCard from "@radix-ui/react-hover-card";
import { TriangleAlert } from "lucide-react";
import { Badge, Tooltip, TooltipContent, TooltipTrigger, cn } from "@evcore/ui";
import { formatMarketForDisplay, formatPickWithTeams } from "@/helpers/fixture";
import { formatOddsValue, frequencyOf } from "@/lib/frequency";
import { OddsBandNote } from "@/components/odds-band-note";
import { useLocale, useTranslations } from "next-intl";
import type {
  ChannelDecisionMatchDecisionDto,
  ChannelSelectionDto,
  ConsensusReasonDetails,
  StrategyChannel,
} from "@/domains/channel-decision/types/channel-decision";
import { AddToCouponButton } from "@/components/add-to-coupon-button";
import type { BetSlipDraftItem } from "@/domains/bet-slip/types/bet-slip";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { ClosingLine } from "@/components/closing-line";
import type { ChannelCompetitionStatItem } from "@/domains/dashboard/types/dashboard";
import {
  CHANNEL_COLOR,
  CHANNEL_COLOR_SOFT,
  channelLabel,
  reasonLabel,
  statusLabel,
} from "./channel-constants";
import { ResultBadge } from "@/components/result-badge";
// Un pick est ajoutable à un coupon sauf s'il vient d'un méta-canal. C'était
// une liste positive de 6 canaux (`SLIPPABLE`) jusqu'au 2026-08-22, figée
// avant l'ouverture des autres : elle privait DOUBLE_CHANCE — le canal le
// mieux mesuré — de bouton, alors qu'Investir permettait déjà de l'ajouter.
import { isMetaChannel } from "./decision-helpers";

export type SlipContext = {
  fixtureId: string;
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string | null;
  scheduledAt: string;
};

function parseConsensusChannels(raw: unknown): StrategyChannel[] {
  if (!raw || typeof raw !== "object") return [];
  const d = raw as Partial<ConsensusReasonDetails>;
  if (!Array.isArray(d.channels)) return [];
  return d.channels.filter((c): c is StrategyChannel => typeof c === "string");
}

export function ChannelRow({
  channel,
  decision,
  locale,
  avoidEdge,
  slipContext,
  teams = null,
}: {
  channel: StrategyChannel;
  decision: ChannelDecisionMatchDecisionDto | undefined;
  locale: string;
  avoidEdge?: number;
  slipContext?: SlipContext;
  /** Pour écrire le pari avec le nom des équipes (« Victoire Arsenal »). */
  teams?: { home: string; away: string } | null;
}) {
  const t = useTranslations("decisions");
  const loc = locale === "en" ? "en" : "fr";
  const selection =
    decision?.status === "SELECTED" ? decision.selections[0] : undefined;

  // Lu depuis reasonDetails, pas depuis les sélections : CONSENSUS n'émet
  // plus de pick, et ces pastilles étaient rendues dans la branche « a une
  // sélection » — elles auraient disparu au premier run suivant.
  const convergingChannels =
    channel === "CONSENSUS" && decision?.status === "SELECTED"
      ? parseConsensusChannels(decision.reasonDetails)
      : [];

  return (
    <div className={cn("py-2.5", avoidEdge !== undefined && "opacity-60")}>
      {selection ? (
        <div className="min-w-0">
          {/* No channel badge here (2026-09-02 redesign §2, "badge de canal
              retiré, nom de marché en clair seul") — most channels are named
              after their own target market (BTTS canal ≈ BTTS marché,
              CORRECT_SCORE ≈ Score exact), so the badge used to just repeat
              the market name below in a different case. The market name
              alone still disambiguates picks that read the same across
              markets (e.g. "Domicile" for both WIN_EITHER_HALF and
              DRAW_NO_BET on the same card) without the duplicate wording. */}
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p className="line-clamp-2 min-w-0 text-sm font-semibold leading-snug text-foreground">
              {formatPickWithTeams(selection.pick, selection.market, teams)}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              {avoidEdge !== undefined && <AvoidEdgeBadge edge={avoidEdge} />}
              <ResultBadge result={selection.result} />
              {slipContext && !isMetaChannel(channel) && decision && (
                <SlipButton
                  channel={channel}
                  decision={decision}
                  selection={selection}
                  slipContext={slipContext}
                />
              )}
            </div>
          </div>
          {/* Type de pari, fréquence, cote jouable d'abord : la même lecture
              que la carte coupon. Plus de badge « Fiable » par canal et par
              championnat : la note par cote ne s'affiche que quand nos
              pourcentages ont été optimistes à cette cote. */}
          <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-snug text-muted-foreground">
            {selection.market !== "CORRECT_SCORE" && (
              <span className="max-w-full truncate">
                {formatMarketForDisplay(selection.market, loc)}
              </span>
            )}
            <span className="tabular-nums">
              {t("chances", frequencyOf(selection.probability))}
            </span>
            <OddsPair selection={selection} locale={locale} />
            <ClosingLine
              closingOdds={selection.closingOdds}
              closingLineValue={selection.closingLineValue}
              closingBookmaker={selection.closingBookmaker}
              marginPaid={selection.marginPaid}
            />
            <OddsBandNote odds={selection.odds} />
          </p>
        </div>
      ) : convergingChannels.length > 0 ? (
        <ConsensusRow channels={convergingChannels} />
      ) : (
        <RejectedLabel decision={decision} />
      )}
    </div>
  );
}

/** Minimum de cote accepté par le bookmaker des joueurs (1xBet). */
const OPERATOR_MIN_ODDS = 1.1;

/**
 * La cote que le joueur trouvera chez son bookmaker d'abord, la nôtre (books
 * les plus généreux du relevé) en référence ; la nôtre seule quand la cote
 * jouable est inconnue ou identique. Sous le minimum de l'opérateur, la cote
 * jouable le dit en clair au lieu d'un rouge sans explication.
 */
function OddsPair({
  selection,
  locale,
}: {
  selection: ChannelSelectionDto;
  locale: string;
}) {
  const t = useTranslations("decisions");
  const { odds, playableOdds, playableBookmaker } = selection;
  if (odds === null) return null;
  const differs =
    playableOdds !== null &&
    playableBookmaker !== null &&
    Math.abs(playableOdds - odds) >= 0.005;
  if (!differs || playableOdds === null || playableBookmaker === null) {
    return (
      <span className="font-semibold tabular-nums text-foreground">
        {playableBookmaker
          ? t("playableLabel", {
              bookmaker: playableBookmaker,
              odds: formatOddsValue(odds, locale),
            })
          : t("oddsLabel", { odds: formatOddsValue(odds, locale) })}
      </span>
    );
  }
  const belowMinimum = playableOdds < OPERATOR_MIN_ODDS;
  return (
    <>
      <span
        data-testid="playable-odds"
        className={cn(
          "font-semibold tabular-nums",
          belowMinimum ? "text-destructive" : "text-foreground",
        )}
      >
        {t("playableLabel", {
          bookmaker: playableBookmaker,
          odds: formatOddsValue(playableOdds, locale),
        })}
      </span>
      <span className="tabular-nums">
        {t("referenceOdds", { odds: formatOddsValue(odds, locale) })}
      </span>
      {belowMinimum && (
        <span className="text-destructive">
          {t("belowMinimum", {
            bookmaker: playableBookmaker,
            min: formatOddsValue(OPERATOR_MIN_ODDS, locale),
          })}
        </span>
      )}
    </>
  );
}

/** Real calibration (ratio réel/annoncé, same 0.85/0.70 thresholds as the
 * VANTAGE gate and the public track-record page — see dashboard.service.ts)
 * replaces the raw probability×odds "edge" figure this row used to show:
 * Rendered as the one-word ConfidenceBadge (« fiable » / « à surveiller » /
 * « peu fiable ») rather than the « Écart ≤ 15 % » measurement band, which
 * repeated calibration jargon under every pick (UX review 2026-10-11, P1-7).
 * that edge is the exact anti-predictive metric CLAUDE.md's overview warns
 * against ("claimed edge is anti-predictive... never a selection floor").
 * `item` is undefined when this (channel, competition) pair never appears
 * in the calibration lookup at all — treated the same as a measured-but-
 * too-thin sample (INSUFFICIENT_DATA). Unlike the rest of the app's "un
 * canal négatif reste affiché comme tel" stance, INSUFFICIENT_DATA renders
 * nothing here rather than a badge: per-competition samples are routinely
 * too thin for a young/low-volume channel (VANTAGE) to ever clear the
 * threshold, and a badge that almost always reads "insuffisant" carries no
 * signal — silence says the same thing without the noise. */
export function CalibrationBadge({
  item,
}: {
  item: ChannelCompetitionStatItem | undefined;
}) {
  const t = useTranslations("decisions");
  const status = item?.status ?? "INSUFFICIENT_DATA";
  // HoverCard (same pattern as InfoTooltip), not Tooltip — a plain hover-only
  // Tooltip never opens on mobile, where there's no hover state at all.
  // Controlling `open` explicitly and toggling it from the trigger's onClick
  // makes tapping the badge work exactly like hovering it on desktop. Hooks
  // stay unconditional (rules of hooks) — the early return comes after.
  const [open, setOpen] = useState(false);

  if (status === "INSUFFICIENT_DATA") return null;

  // Plain-language verdict, no raw ratio/n= notation in the visible text —
  // "0.58×" and "n=223" read as internal jargon to a lambda user (2quater).
  const detail = t("calibration.badgeTooltip", {
    status,
    n: item?.sampleSize ?? 0,
  });

  return (
    <HoverCard.Root
      open={open}
      onOpenChange={setOpen}
      openDelay={200}
      closeDelay={100}
    >
      <HoverCard.Trigger asChild>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex focus:outline-none"
        >
          <ConfidenceBadge status={status} className="py-0" />
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          sideOffset={8}
          onEscapeKeyDown={() => setOpen(false)}
          onPointerDownOutside={() => setOpen(false)}
          className="z-50 w-64 rounded-2xl border border-border bg-panel p-3 text-xs text-foreground shadow-lg"
        >
          {detail}
          <HoverCard.Arrow className="fill-panel" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}

function AvoidEdgeBadge({ edge }: { edge: number }) {
  const t = useTranslations("decisions");
  const edgePct = `+${Math.round(edge * 100)}%`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[0.6rem] font-semibold tabular-nums"
          style={{
            color: "var(--canal-avoid)",
            backgroundColor: "var(--canal-avoid-soft)",
          }}
        >
          <TriangleAlert className="size-2.5" />
          {edgePct}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {t("avoid.edgeTooltip", { pct: edgePct })}
      </TooltipContent>
    </Tooltip>
  );
}

/** CONSENSUS n'a pas de pick : il montre qui converge, et c'est tout. */
function ConsensusRow({ channels }: { channels: StrategyChannel[] }) {
  const t = useTranslations("decisions");
  const locale = useLocale();
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-[0.68rem] text-muted-foreground">
        {t("consensus.rowLabel")}
      </span>
      {channels.map((ch) => (
        <Badge
          key={ch}
          className="border-transparent px-0 py-0 text-[0.58rem] font-semibold uppercase tracking-wide"
          style={{
            color: CHANNEL_COLOR[ch],
            backgroundColor: CHANNEL_COLOR_SOFT[ch],
          }}
        >
          {channelLabel(ch, locale)}
        </Badge>
      ))}
    </div>
  );
}

function RejectedLabel({
  decision,
}: {
  decision: ChannelDecisionMatchDecisionDto | undefined;
}) {
  const t = useTranslations("decisions");
  if (decision === undefined) {
    return <span className="text-xs text-muted-foreground/60">—</span>;
  }

  const reason = reasonLabel(decision.reasonCode, t);
  const status = statusLabel(decision.status, t);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="line-clamp-2 min-w-0 text-xs leading-snug text-muted-foreground/70">
          {status}
          {reason ? ` · ${reason}` : ""}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {reason ?? status}
      </TooltipContent>
    </Tooltip>
  );
}

function SlipButton({
  channel,
  decision,
  selection,
  slipContext,
}: {
  channel: StrategyChannel;
  decision: ChannelDecisionMatchDecisionDto;
  selection: ChannelSelectionDto;
  slipContext: SlipContext;
}) {
  const item: BetSlipDraftItem = {
    modelRunId: decision.modelRunId,
    fixtureId: slipContext.fixtureId,
    fixture: slipContext.fixture,
    homeLogo: slipContext.homeLogo,
    awayLogo: slipContext.awayLogo,
    competition: slipContext.competition ?? "",
    scheduledAt: slipContext.scheduledAt,
    market: selection.market,
    pick: selection.pick,
    // Le prix que l'utilisateur trouvera chez 1xBet quand il est connu ; le
    // serveur enregistre le même au moment de jouer (BetSlipService.create).
    odds:
      selection.playableOdds !== null
        ? String(selection.playableOdds)
        : selection.odds !== null
          ? String(selection.odds)
          : null,
    ev:
      selection.ev !== null
        ? `${selection.ev >= 0 ? "+" : ""}${(selection.ev * 100).toFixed(0)}%`
        : null,
    canal: channel,
    stakeOverride: null,
  };

  return <AddToCouponButton item={item} />;
}
