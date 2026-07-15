import type { ReactNode } from "react";
import { FixtureName } from "@/components/fixture-name";
import { translateCountry, translateCompetition } from "@/lib/competition-i18n";
import { formatScore } from "@/domains/fixture/helpers/fixture";

/** Shared match card header: team names + logos on one line (headerExtra, e.g.
 * a consensus badge, pinned to the right), competition/country/kickoff/metaExtra
 * as a meta line underneath with the score pinned to its right — the score sits
 * there rather than crowding the team-name row. Used wherever a fixture heads up
 * a card (Investment, decisions). */
export function FixtureCardHeader({
  fixture,
  homeLogo,
  awayLogo,
  competition,
  country,
  kickoff,
  score,
  htScore,
  locale,
  metaExtra,
}: {
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string | null;
  country: string | null;
  kickoff: string;
  score: string | null;
  htScore: string | null;
  locale: string;
  /** Extra info appended after the kickoff time in the meta line (e.g. pick count). */
  metaExtra?: ReactNode;
}) {
  const loc = locale === "en" ? "en" : "fr";
  const scoreLabel = formatScore(score, htScore);

  return (
    <div className="min-w-0 flex-1">
      <FixtureName
        fixture={fixture}
        homeLogo={homeLogo}
        awayLogo={awayLogo}
        className="min-w-0 text-xs font-semibold text-foreground"
        stacked
      />
      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-[0.7rem] text-muted-foreground">
          {competition ? translateCompetition(competition, loc) : null}
          {country ? ` · ${translateCountry(country, loc)}` : null}
          {` · ${kickoff}`}
          {metaExtra}
        </p>
        {scoreLabel && (
          <span className="shrink-0 font-mono text-[0.7rem] font-medium text-foreground">
            {scoreLabel}
          </span>
        )}
      </div>
    </div>
  );
}
