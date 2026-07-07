import { FixtureName } from "@/components/fixture-name";
import { translateCountry, translateCompetition } from "@/lib/competition-i18n";
import { formatScore } from "@/domains/fixture/helpers/fixture";

/** Shared match card header: team names + logos on one line with the score
 * pinned to the right, competition/country/kickoff as a meta line underneath.
 * Used wherever a fixture heads up a card (Investment, decisions). */
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
}) {
  const loc = locale === "en" ? "en" : "fr";
  const scoreLabel = formatScore(score, htScore);

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-2">
        <FixtureName
          fixture={fixture}
          homeLogo={homeLogo}
          awayLogo={awayLogo}
          className="min-w-0 text-sm font-semibold text-foreground"
        />
        {scoreLabel && (
          <span className="shrink-0 font-mono text-xs font-medium text-foreground">
            {scoreLabel}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
        {competition ? translateCompetition(competition, loc) : null}
        {country ? ` · ${translateCountry(country, loc)}` : null}
        {` · ${kickoff}`}
      </p>
    </div>
  );
}
