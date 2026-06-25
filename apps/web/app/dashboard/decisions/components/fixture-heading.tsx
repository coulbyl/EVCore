"use client";

import Image from "next/image";
import { translateCompetition, translateCountry } from "@/lib/competition-i18n";
import { formatScore } from "@/domains/fixture/helpers/fixture";
import { useIsMobile } from "@/hooks/use-mobile";

function Logo({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt=""
      width={14}
      height={14}
      className="size-3.5 shrink-0 object-contain"
    />
  );
}

type FixtureHeadingProps = {
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string | null;
  country: string | null;
  locale: string;
  kickoff?: string;
  score?: string | null;
  htScore?: string | null;
};

// Team line (logos + names) + league meta (country · competition · [kickoff]),
// mirroring the shared pick-card heading. On mobile the two teams stack on their
// own full-width rows so long names stay readable instead of being truncated to
// a single letter by the inline "home – away" layout.
export function FixtureHeading(props: FixtureHeadingProps) {
  const isMobile = useIsMobile();
  const { competition, country, locale, kickoff, score, htScore } = props;

  const league = competition ? translateCompetition(competition, locale) : "—";
  const meta = [country ? translateCountry(country, locale) : null, league]
    .filter(Boolean)
    .join(" · ");
  const scoreLabel = formatScore(score ?? null, htScore ?? null);

  return (
    <div className="min-w-0">
      {isMobile ? (
        <MobileTeams {...props} scoreLabel={scoreLabel} />
      ) : (
        <DesktopTeams {...props} scoreLabel={scoreLabel} />
      )}
      <p className="line-clamp-2 text-xs text-muted-foreground sm:truncate">
        {meta}
        {kickoff ? (
          <span className="ml-1.5 tabular-nums">{kickoff}</span>
        ) : null}
      </p>
    </div>
  );
}

function DesktopTeams({
  homeTeam,
  awayTeam,
  homeLogo,
  awayLogo,
  scoreLabel,
}: FixtureHeadingProps & { scoreLabel: string | null }) {
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold leading-snug">
      {homeLogo && <Logo src={homeLogo} />}
      <span className="truncate">{homeTeam}</span>
      <span className="shrink-0 font-normal text-muted-foreground">–</span>
      {awayLogo && <Logo src={awayLogo} />}
      <span className="truncate">{awayTeam}</span>
      {scoreLabel && (
        <span className="ml-1 shrink-0 font-mono text-xs font-medium text-foreground">
          {scoreLabel}
        </span>
      )}
    </p>
  );
}

function MobileTeams({
  homeTeam,
  awayTeam,
  homeLogo,
  awayLogo,
  scoreLabel,
}: FixtureHeadingProps & { scoreLabel: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm font-semibold leading-tight">
        <span className="flex min-w-0 items-center gap-1.5">
          {homeLogo && <Logo src={homeLogo} />}
          <span className="line-clamp-2">{homeTeam}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          {awayLogo && <Logo src={awayLogo} />}
          <span className="line-clamp-2">{awayTeam}</span>
        </span>
      </div>
      {scoreLabel && (
        <span className="shrink-0 font-mono text-xs font-medium text-foreground">
          {scoreLabel}
        </span>
      )}
    </div>
  );
}
