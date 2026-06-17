import Image from "next/image";
import { translateCompetition, translateCountry } from "@/lib/competition-i18n";
import { formatScore } from "@/domains/fixture/helpers/fixture";

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

// Team line (logos + names) + league meta (country · competition · [kickoff]),
// mirroring the shared pick-card heading.
export function FixtureHeading({
  homeTeam,
  awayTeam,
  homeLogo,
  awayLogo,
  competition,
  country,
  locale,
  kickoff,
  score,
  htScore,
}: {
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
}) {
  const league = competition
    ? translateCompetition(competition, locale)
    : "—";
  const meta = [country ? translateCountry(country, locale) : null, league]
    .filter(Boolean)
    .join(" · ");
  const scoreLabel = formatScore(score ?? null, htScore ?? null);

  return (
    <div className="min-w-0">
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
      <p className="truncate text-xs text-muted-foreground">
        {meta}
        {kickoff ? <span className="ml-1.5 tabular-nums">{kickoff}</span> : null}
      </p>
    </div>
  );
}
