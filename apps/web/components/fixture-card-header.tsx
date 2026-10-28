import type { ReactNode } from "react";
import { FixtureName } from "@/components/fixture-name";
import { translateCountry, translateCompetition } from "@/lib/competition-i18n";
import { formatScore } from "@/domains/fixture/helpers/fixture";

/** Shared match card header: team names + logos on one line (headerExtra, e.g.
 * a consensus badge, pinned to the right), competition/country/kickoff/metaExtra
 * as a meta line underneath with the score pinned to its right — the score sits
 * there rather than crowding the team-name row. Used wherever a fixture heads up
 * a card. */
export function FixtureCardHeader({
  fixture,
  homeLogo,
  awayLogo,
  homeBadge,
  awayBadge,
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
  /** Rendered right after that team's name (e.g. a "new coach" chip). */
  homeBadge?: ReactNode;
  awayBadge?: ReactNode;
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
        homeBadge={homeBadge}
        awayBadge={awayBadge}
        className="min-w-0 text-xs font-semibold text-foreground"
        stacked
      />
      {/* L'heure d'abord, jamais tronquée : c'est la seule contrainte d'un
          pari (« avant quelle heure ? »). Seuls compétition et pays se
          tronquent quand la place manque (revue UX du 2026-10-24, P1 n°4 :
          à 375 px l'heure disparaissait sur toutes les jambes). */}
      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        <p className="flex min-w-0 items-baseline gap-1 text-xs text-muted-foreground">
          <span className="shrink-0 tabular-nums text-foreground/80">
            {kickoff}
          </span>
          {competition || country ? (
            <span className="min-w-0 truncate">
              {" · "}
              {competition ? translateCompetition(competition, loc) : null}
              {competition && country ? " · " : null}
              {country ? translateCountry(country, loc) : null}
            </span>
          ) : null}
          {metaExtra}
        </p>
        {scoreLabel && (
          <span className="shrink-0 font-mono text-xs font-medium text-foreground">
            {scoreLabel}
          </span>
        )}
      </div>
    </div>
  );
}
