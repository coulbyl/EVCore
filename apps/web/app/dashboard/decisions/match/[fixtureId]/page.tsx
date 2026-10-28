import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { Page, PageContent } from "@evcore/ui";
import { serverApiRequest } from "@/lib/api/server-api";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import { activePauseEnd } from "@/domains/auth/types/auth";
import { PausedPage } from "@/components/pause-gate";
import type {
  FixtureEvaluatedPickSnapshot,
  FixtureSheet,
} from "@/domains/fixture/types/fixture";
import { formatMarketForDisplay, formatPickWithTeams } from "@/helpers/fixture";
import { formatOddsValue, frequencyOf } from "@/lib/frequency";
import { translateCountry } from "@/lib/competition-i18n";

export const metadata: Metadata = { title: "Fiche du match — EVCore" };

/**
 * La fiche d'un match pour le joueur, ouverte depuis une carte de Décisions
 * (décision du 2026-10-27, docs/audits/2026-10-27/MATCHS.md). Elle remplace,
 * côté joueur, l'écran Matchs : les buts attendus avec le nom des équipes,
 * les facteurs en mots et tout ce que le moteur a écarté, avec le motif.
 *
 * Pas d'EV, pas de « Viable », pas de panier : l'EV est anti-prédictif, et
 * on ajoute au coupon depuis Décisions, derrière les garde-fous du moteur.
 * Rien n'est filtré ni classé : les lectures écartées sont toutes là, dans
 * l'ordre du moteur, groupées par type de pari (fiche = diagnostic).
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

export default async function MatchSheetPage({
  params,
}: {
  params: Promise<{ fixtureId: string }>;
}) {
  const { fixtureId } = await params;
  // En pause, le serveur refuse la fiche (403) : on l'annonce au lieu d'un
  // « match introuvable ».
  const session = await getCurrentSession();
  const pauseEnd = activePauseEnd(session?.user.pausedUntil ?? null);
  if (pauseEnd) return <PausedPage until={pauseEnd} />;
  const sheet = await loadSheet(fixtureId);
  if (!sheet) notFound();

  const t = await getTranslations("matchSheet");
  const locale = await getLocale();
  const loc = locale === "en" ? "en" : "fr";
  const teams = { home: sheet.homeTeam, away: sheet.awayTeam };
  const run = sheet.modelRun;
  const day = sheet.scheduledAt.slice(0, 10);
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

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-20">
          <Link
            href={`/dashboard/decisions?date=${day}`}
            className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} />
            {t("back")}
          </Link>

          <header className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">
              {sheet.competition}
              {sheet.country
                ? ` · ${translateCountry(sheet.country, locale)}`
                : ""}{" "}
              · {kickoff}
            </p>
            <h1 className="text-balance text-xl font-semibold tracking-tight text-foreground">
              {sheet.homeTeam} – {sheet.awayTeam}
              {sheet.score ? ` · ${sheet.score.replace(" - ", "–")}` : ""}
            </h1>
          </header>

          {!run ? (
            <p className="text-sm text-muted-foreground">{t("noAnalysis")}</p>
          ) : (
            <>
              {lambdaHome !== null && lambdaAway !== null && (
                <section className="flex flex-col gap-1.5">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {t("expectedTitle")}
                  </h2>
                  <p
                    data-testid="sheet-expected"
                    className="text-sm leading-6 text-foreground"
                  >
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
                  <p className="text-xs text-muted-foreground">
                    {t("expectedNote")}
                  </p>
                </section>
              )}

              {factors.length > 0 && (
                <section className="flex flex-col gap-1.5">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {t("factorsTitle")}
                  </h2>
                  <ul className="divide-y divide-border rounded-2xl border border-border bg-panel">
                    {factors.map((f) => (
                      <li
                        key={f.label}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                      >
                        <span className="text-muted-foreground">{f.label}</span>
                        <span className="font-medium text-foreground">
                          {f.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="flex flex-col gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {t("rejectedTitle")}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {rejected.length > 0
                    ? t("rejectedIntro", {
                        evaluated: evaluated.length,
                        rejected: rejected.length,
                      })
                    : t("rejectedNone")}
                </p>
                {[...groups.entries()].map(([market, picks]) => (
                  <details
                    key={market}
                    data-testid="sheet-rejected-group"
                    className="group rounded-2xl border border-border bg-panel"
                  >
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-medium text-foreground">
                      {formatMarketForDisplay(market, loc)} ({picks.length})
                      <ChevronDown
                        size={16}
                        className="text-muted-foreground transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <ul className="divide-y divide-border border-t border-border">
                      {picks.map((pick) => (
                        <li
                          key={`${pick.market}:${pick.pick}`}
                          className="flex flex-col gap-0.5 px-4 py-2.5"
                        >
                          <span className="text-sm text-foreground">
                            {formatPickWithTeams(pick.pick, pick.market, teams)}
                          </span>
                          <span className="text-xs text-muted-foreground">
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
              </section>
            </>
          )}

          <Link
            href={`/dashboard/decisions?date=${day}`}
            className="inline-flex min-h-11 w-fit items-center text-sm font-medium text-accent underline underline-offset-4"
          >
            {t("seeDecisions")}
          </Link>
        </div>
      </PageContent>
    </Page>
  );
}
