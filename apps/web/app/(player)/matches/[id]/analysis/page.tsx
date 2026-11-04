import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { SubpageBand } from "@/components/scoreboard/shell/subpage-band";
import {
  activePause,
  PausedScreen,
} from "@/components/scoreboard/states/paused-screen";
import type {
  FixtureEvaluatedPickSnapshot,
  FixtureSheet,
} from "@/domains/fixture/types/fixture";
import { formatMarketForDisplay, formatPickWithTeams } from "@/helpers/fixture";
import { serverApiRequest } from "@/lib/api/server-api";
import { translateCountry } from "@/lib/competition-i18n";
import { formatOddsValue, frequencyOf } from "@/lib/frequency";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("matchSheet");
  return { title: `${t("title")} — EVCore`, robots: { index: false } };
}

/**
 * The analysis of a match (12-admin.md § 2, open to every signed-in player
 * since 04/11: « for those who want to go deeper »), opened from the
 * stethoscope of the match sheet: expected goals with the teams' names,
 * the factors in words, and every reading the engine set aside with its
 * motive, grouped by bet type, in the engine's order. Nothing filtered or
 * ranked (the sheet is a diagnostic). No bookmaker named, no margin.
 */

async function loadSheet(fixtureId: string): Promise<FixtureSheet | null> {
  try {
    return await serverApiRequest<FixtureSheet>(`/fixture/${fixtureId}/sheet`);
  } catch {
    return null;
  }
}

function goals(value: number): string {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("matchSheet");
  // Paused: Matchs is closed and the server refuses the read (PausedGuard).
  const pauseEnd = await activePause();
  if (pauseEnd) return <PausedScreen until={pauseEnd} title={t("title")} />;
  const sheet = await loadSheet(id);
  if (!sheet) notFound();

  const locale = await getLocale();
  const loc = locale === "en" ? "en" : "fr";
  const teams = { home: sheet.homeTeam, away: sheet.awayTeam };
  const run = sheet.modelRun;
  const kickoff = new Date(sheet.scheduledAt).toLocaleString(
    locale === "en" ? "en-GB" : "fr-FR",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

  const lambdaHome = run?.lambdaHome ? Number(run.lambdaHome) : null;
  const lambdaAway = run?.lambdaAway ? Number(run.lambdaAway) : null;
  const total = run?.expectedTotalGoals ? Number(run.expectedTotalGoals) : null;

  const leanOf = (value: number | null): string | null => {
    if (value === null) return null;
    if (value > 0.55) return t("lean.side", { team: sheet.homeTeam });
    if (value < 0.45) return t("lean.side", { team: sheet.awayTeam });
    return t("lean.even");
  };
  const leagueOf = (value: number | null): string | null => {
    if (value === null) return null;
    if (value >= 0.6) return t("league.high");
    if (value <= 0.35) return t("league.low");
    return t("league.mid");
  };
  const factors = run?.factors
    ? [
        { label: t("factor.recentForm"), text: leanOf(run.factors.recentForm) },
        { label: t("factor.xg"), text: leanOf(run.factors.xg) },
        {
          label: t("factor.performanceDomExt"),
          text: leanOf(run.factors.performanceDomExt),
        },
        {
          label: t("factor.volatiliteLigue"),
          text: leagueOf(run.factors.volatiliteLigue),
        },
      ].filter((f): f is { label: string; text: string } => f.text !== null)
    : [];

  const evaluated = run?.evaluatedPicks ?? [];
  const rejected = evaluated.filter((p) => p.status === "rejected");
  const groups = new Map<string, FixtureEvaluatedPickSnapshot[]>();
  for (const pick of rejected) {
    const list = groups.get(pick.market) ?? [];
    list.push(pick);
    groups.set(pick.market, list);
  }
  const motive = (reason: string | undefined) =>
    reason && t.has(`motive.${reason}`)
      ? t(`motive.${reason}`)
      : t("motive.other");

  const heading = "text-meta font-semibold text-muted-foreground";

  return (
    <>
      <SubpageBand
        title={`${sheet.homeTeam} – ${sheet.awayTeam}${
          sheet.score ? ` · ${sheet.score.replace(" - ", "–")}` : ""
        }`}
        subtitle={`${sheet.competition}${
          sheet.country ? ` · ${translateCountry(sheet.country, locale)}` : ""
        } · ${kickoff}`}
        back={{ href: `/matches/${id}`, label: t("back") }}
      />
      <div className="flex flex-col gap-6 px-4 pt-3 pb-4 lg:px-6">
        {!run ? (
          <p className="text-body text-muted-foreground">{t("noAnalysis")}</p>
        ) : (
          <>
            {lambdaHome !== null && lambdaAway !== null ? (
              <section className="flex flex-col gap-1">
                <h2 className={heading}>{t("expectedTitle")}</h2>
                <p data-testid="sheet-expected" className="text-body">
                  {t("expected", {
                    home: sheet.homeTeam,
                    homeGoals: goals(lambdaHome),
                    homeUnit: lambdaHome < 2 ? "but" : "buts",
                    away: sheet.awayTeam,
                    awayGoals: goals(lambdaAway),
                    awayUnit: lambdaAway < 2 ? "but" : "buts",
                    total: goals(total ?? lambdaHome + lambdaAway),
                  })}
                </p>
                <p className="text-meta text-muted-foreground">
                  {t("expectedNote")}
                </p>
              </section>
            ) : null}

            {factors.length > 0 ? (
              <section className="flex flex-col gap-1">
                <h2 className={heading}>{t("factorsTitle")}</h2>
                <ul className="divide-y divide-border">
                  {factors.map((f) => (
                    <li
                      key={f.label}
                      className="flex min-h-11 items-center justify-between gap-3 text-body"
                    >
                      <span className="text-muted-foreground">{f.label}</span>
                      <span className="font-medium">{f.text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="flex flex-col gap-2">
              <h2 className={heading}>{t("rejectedTitle")}</h2>
              <p className="text-body text-muted-foreground">
                {rejected.length > 0
                  ? t("rejectedIntro", {
                      evaluated: evaluated.length,
                      rejected: rejected.length,
                    })
                  : t("rejectedNone")}
              </p>
              <div className="flex flex-col divide-y divide-border border-y border-border">
                {[...groups.entries()].map(([market, picks]) => (
                  <details
                    key={market}
                    data-testid="sheet-rejected-group"
                    className="group"
                  >
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 text-body font-medium">
                      {formatMarketForDisplay(market, loc)} ({picks.length})
                      <ChevronDown
                        aria-hidden
                        className="size-4 text-icon-subtle transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <ul className="flex flex-col gap-2 pb-3">
                      {picks.map((pick) => (
                        <li
                          key={`${pick.market}:${pick.pick}`}
                          className="flex flex-col gap-0.5"
                        >
                          <span className="text-body">
                            {formatPickWithTeams(pick.pick, pick.market, teams)}
                          </span>
                          <span className="text-meta text-muted-foreground">
                            {t("line", {
                              ...frequencyOf(
                                Number(
                                  pick.marketProbability ?? pick.probability,
                                ),
                              ),
                              odds: formatOddsValue(Number(pick.odds), locale),
                              motive: motive(pick.rejectionReason),
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
