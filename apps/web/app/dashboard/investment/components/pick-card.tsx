import Image from "next/image";
import { formatTime } from "@/lib/date";
import { translateCountry, translateCompetition } from "@/lib/competition-i18n";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import { formatScore } from "@/domains/fixture/helpers/fixture";
import type { InvestmentPickDto } from "@/domains/ai-engine/types/investment";
import { CANAL_COLOR } from "./canal-constants";
import { ResultBadge } from "./result-badge";
import { SlipButton } from "./slip-button";

export function PickCard({
  pick,
  locale,
}: {
  pick: InvestmentPickDto;
  locale: string;
}) {
  const color = CANAL_COLOR[pick.canal];
  const loc = locale === "en" ? "en" : "fr";
  const marketLabel = formatMarketForDisplay(pick.market, loc);
  const pickLabel = formatPickForDisplay(pick.pick, pick.market);
  const confidencePct = (pick.probability * 100).toFixed(1);
  const scoreLabel = formatScore(pick.score, pick.htScore);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/70 bg-card p-3 pl-4 flex flex-col gap-1.5 transition-colors hover:border-border">
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: color }}
      />

      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs font-semibold leading-snug">
          {pick.homeLogo && (
            <Image
              src={pick.homeLogo}
              alt={pick.homeTeam}
              width={14}
              height={14}
              className="size-3.5 shrink-0 object-contain"
            />
          )}
          <span className="truncate">{pick.homeTeam}</span>
          <span className="font-normal text-muted-foreground">–</span>
          {pick.awayLogo && (
            <Image
              src={pick.awayLogo}
              alt={pick.awayTeam}
              width={14}
              height={14}
              className="size-3.5 shrink-0 object-contain"
            />
          )}
          <span className="truncate">{pick.awayTeam}</span>
        </span>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-bold tabular-nums"
          style={{
            color,
            background: `color-mix(in srgb, ${color} 14%, transparent)`,
          }}
        >
          {confidencePct}%
        </span>
      </div>

      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{marketLabel}</span>
        {" · "}
        <span className="font-medium text-foreground">{pickLabel}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mt-0.5">
        <span className="whitespace-nowrap uppercase tracking-widest text-[0.6rem]">
          {translateCountry(pick.country, locale)} · {translateCompetition(pick.competition, locale)}
        </span>
        <span className="opacity-40">·</span>
        <span className="whitespace-nowrap">
          {formatTime(pick.scheduledAt)}
        </span>
        {pick.oddsSnapshot != null && (
          <>
            <span className="opacity-40">·</span>
            <span className="whitespace-nowrap font-mono text-foreground">
              @{pick.oddsSnapshot.toFixed(2)}
            </span>
          </>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {scoreLabel && (
            <span className="whitespace-nowrap font-mono text-[0.7rem] text-foreground">
              {scoreLabel}
            </span>
          )}
          <ResultBadge isCorrect={pick.isCorrect} />
          <SlipButton pick={pick} />
        </div>
      </div>

      {pick.reasoning && (
        <p className="border-t border-border/50 pt-1.5 text-xs leading-snug text-muted-foreground">
          {pick.reasoning}
        </p>
      )}
    </div>
  );
}
