import { useId } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Sheet } from "@/components/scoreboard/sheet/sheet";
import { activePause } from "@/components/scoreboard/states/paused-screen";
import { ChanceFigure } from "@/components/scoreboard/ui/chance-figure";
import { ResultMark } from "@/components/scoreboard/ui/result-mark";
import { AddToTicket } from "@/components/scoreboard/ticket/add-to-ticket";
import { getMatchSheet } from "@/domains/matches/use-cases/get-match-sheet";
import type {
  MatchSheet,
  SheetPick,
  SheetTeamForm,
} from "@/domains/matches/types/match-sheet";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import {
  displayLocaleOf,
  formatOdds,
  formatShortDate,
  formatTime,
  type DisplayLocale,
} from "@/helpers/scoreboard-format";
import { TeamMark } from "../../today/components/team-mark";
import { AiSpeech } from "./ai-speech";
import { pickLabel } from "./matches-constants";

/** « Autres paris » shown before « Tous » (maquette Fiche). */
const OTHER_PICKS_SHOWN = 4;

type Translate = Awaited<ReturnType<typeof getTranslations<"matches.sheet">>>;

/**
 * The match sheet of the player (06 § 2–4, maquette Fiche), the same on a
 * tap (intercepted route) and on a shared link or a reload (the `@sheet`
 * slot's own page, over Matchs). From top to bottom: the header, « Notre
 * lecture » with its fact, « Avis IA » as one more bet with its speech in a popover, the form of both
 * teams and the head-to-head, « Autres paris ». No bookmaker's margin:
 * shown to the player, it read as running 1xBet down (decided 31/10).
 * Rendered on the server: the sheet adds no JavaScript of its own.
 */
export async function MatchSheetView({ id }: { id: string }) {
  // Paused: Matchs is closed and the server would refuse the read.
  if (await activePause()) return null;
  const [sheet, t, locale, timeZone] = await Promise.all([
    getMatchSheet(id),
    getTranslations("matches.sheet"),
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const display = displayLocaleOf(locale);
  const muted = sheet.state === "postponed";

  return (
    <Sheet
      title={`${sheet.home.name} – ${sheet.away.name}`}
      fallbackHref="/matches"
      tone="band"
      bandContent={
        <SheetHeader sheet={sheet} t={t} locale={display} timeZone={timeZone} />
      }
    >
      <div
        className={
          muted
            ? "flex flex-col divide-y divide-border text-muted-foreground"
            : "flex flex-col divide-y divide-border"
        }
      >
        <Section title={t("ourReading")}>
          {sheet.reading ? (
            <>
              <PickLine
                pick={sheet.reading}
                sheet={sheet}
                t={t}
                locale={display}
                strong
              />
              {sheet.reading.chance !== null && sheet.state !== "finished" ? (
                <ChanceFigure
                  probability={sheet.reading.chance}
                  phrasing="passes"
                  size="sm"
                />
              ) : null}
              {sheet.reading.fact ? (
                <p className="text-body text-muted-foreground">
                  {sheet.reading.fact}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-body text-muted-foreground">
              {sheet.setAsideReason
                ? t(`setAside.${sheet.setAsideReason}`)
                : t(`without.${sheet.withoutReading ?? "not_analysed"}`)}
            </p>
          )}
        </Section>

        <Section title={t("ai")}>
          {!sheet.ai ? (
            <p className="text-body text-muted-foreground">{t("noAi")}</p>
          ) : (
            <>
              <PickLine pick={sheet.ai} sheet={sheet} t={t} locale={display} />
              {sheet.ai.sameAsReading ? (
                <p className="text-meta text-muted-foreground">
                  {t("sameAsReading")}
                </p>
              ) : null}
              {sheet.ai.speech ? (
                <AiSpeech
                  id={`ai-speech-${sheet.fixtureId}`}
                  speech={sheet.ai.speech}
                  labels={{
                    open: t("aiSpeech"),
                    title: t("ai"),
                    close: t("aiSpeechClose"),
                  }}
                />
              ) : null}
              <p className="text-meta text-muted-foreground">
                {t("aiDecidedAt", {
                  date: formatShortDate(
                    new Date(sheet.ai.decidedAt),
                    display,
                    timeZone,
                  ),
                  time: formatTime(
                    new Date(sheet.ai.decidedAt),
                    display,
                    timeZone,
                  ),
                })}
              </p>
            </>
          )}
        </Section>

        <Section title={t("form")}>
          <FormLine team={sheet.home} form={sheet.form.home} t={t} />
          <FormLine team={sheet.away} form={sheet.form.away} t={t} />
          {sheet.headToHead ? (
            <p className="text-body text-muted-foreground">
              {sheet.headToHead}
            </p>
          ) : null}
        </Section>

        {sheet.otherPicks.length > 0 ? (
          <OtherPicks sheet={sheet} t={t} locale={display} />
        ) : null}
      </div>
    </Sheet>
  );
}

/**
 * On the band: the competition, the two teams, then the time, « En cours »,
 * « Reporté », or the score with the half-time score in small (06 § 3).
 */
function SheetHeader({
  sheet,
  t,
  locale,
  timeZone,
}: {
  sheet: MatchSheet;
  t: Translate;
  locale: DisplayLocale;
  timeZone: string;
}) {
  const status =
    sheet.state === "live"
      ? t("inProgress")
      : sheet.state === "postponed"
        ? t("postponed")
        : sheet.state === "finished" && sheet.halfTimeScore
          ? t("halfTime", sheet.halfTimeScore)
          : sheet.state === "finished"
            ? null
            : formatTime(new Date(sheet.kickoffAt), locale, timeZone);
  return (
    <div className="flex flex-col gap-2">
      <p className="flex justify-between gap-3 text-meta text-band-muted">
        <span>{sheet.competition.name}</span>
        {status ? <span className="score">{status}</span> : null}
      </p>
      {(
        [
          [sheet.home, sheet.score?.home],
          [sheet.away, sheet.score?.away],
        ] as const
      ).map(([team, goals]) => (
        <div key={team.name} className="flex items-center gap-2.5">
          <TeamMark team={team} />
          <span className="flex-1 text-bet font-medium">{team.name}</span>
          {goals !== undefined ? (
            <span className="score text-title font-bold">{goals}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * The [+] of a bet (06 § 2, 07 § 4): a match still to come, a bet 1xBet
 * prices. Live, finished or postponed: none (06 § 3).
 */
function AddButton({ pick, sheet }: { pick: SheetPick; sheet: MatchSheet }) {
  if (sheet.state !== "upcoming" || pick.odds === null) return null;
  return (
    <AddToTicket
      leg={{
        fixtureId: sheet.fixtureId,
        market: pick.market,
        pick: pick.pick,
        label: pickLabel(pick, sheet),
        home: sheet.home,
        away: sheet.away,
        kickoffAt: sheet.kickoffAt,
        odds: pick.odds,
      }}
    />
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2 py-4">
      <h3 id={id} className="text-meta text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * A bet with its 1xBet price, « Victoire Arsenal 1,65 », and its mark once
 * the match is over. Its chance is told once, under our reading only.
 */
function PickLine({
  pick,
  sheet,
  t,
  locale,
  strong = false,
}: {
  pick: SheetPick;
  sheet: MatchSheet;
  t: Translate;
  locale: DisplayLocale;
  strong?: boolean;
}) {
  return (
    <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span className={strong ? "text-bet font-semibold" : "text-bet"}>
        {pickLabel(pick, sheet)}
      </span>
      <span className="flex items-center gap-3">
        {pick.odds !== null ? (
          <span className="score text-bet font-semibold">
            {formatOdds(pick.odds, locale)}
          </span>
        ) : null}
        <Mark result={pick.result} t={t} />
        <AddButton pick={pick} sheet={sheet} />
      </span>
    </p>
  );
}

function Mark({ result, t }: { result: SheetPick["result"]; t: Translate }) {
  if (result === "won" || result === "lost") {
    return <ResultMark kind={result} label={t(`result.${result}`)} />;
  }
  if (result === "void") {
    return <ResultMark kind="void" label={t("result.void")} />;
  }
  return null;
}

/** Five results, oldest first, and the days of rest (06 § 2). */
function FormLine({
  team,
  form,
  t,
}: {
  team: MatchSheet["home"];
  form: SheetTeamForm;
  t: Translate;
}) {
  const count = (outcome: SheetTeamForm["last"][number]) =>
    form.last.filter((o) => o === outcome).length;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="w-28 shrink-0 truncate text-body font-medium">
        {team.name}
      </span>
      {form.last.length > 0 ? (
        <span
          role="img"
          aria-label={t("formSummary", {
            won: count("won"),
            drawn: count("drawn"),
            lost: count("lost"),
          })}
          className="flex items-center gap-1"
        >
          {form.last.map((outcome, index) => (
            <ResultMark
              key={index}
              kind={
                outcome === "won" ? "won" : outcome === "lost" ? "lost" : "void"
              }
              size="sm"
            />
          ))}
        </span>
      ) : null}
      {form.restDays !== null ? (
        <span className="text-meta text-muted-foreground">
          {t("rest", { days: form.restDays })}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The main 1xBet lines and the engine's other picks, by market chance, with
 * their price only (06 § 2); once the match is over, what landed, without
 * the price (06 § 3).
 */
function OtherPicks({
  sheet,
  t,
  locale,
}: {
  sheet: MatchSheet;
  t: Translate;
  locale: DisplayLocale;
}) {
  const finished = sheet.state === "finished";
  const line = (pick: SheetPick) => (
    <li
      key={`${pick.market}|${pick.pick}`}
      className="flex items-baseline justify-between gap-3 py-2"
    >
      <span className="text-body">{pickLabel(pick, sheet)}</span>
      <span className="flex items-center gap-2 text-body">
        {!finished && pick.odds !== null ? (
          <span className="score font-semibold">
            {formatOdds(pick.odds, locale)}
          </span>
        ) : null}
        {finished ? <Mark result={pick.result} t={t} /> : null}
        <AddButton pick={pick} sheet={sheet} />
      </span>
    </li>
  );
  const shown = sheet.otherPicks.slice(0, OTHER_PICKS_SHOWN);
  const rest = sheet.otherPicks.slice(OTHER_PICKS_SHOWN);
  return (
    <Section title={t("otherPicks")}>
      <ul className="divide-y divide-border">{shown.map(line)}</ul>
      {rest.length > 0 ? (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-body font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring group-open:hidden [&::-webkit-details-marker]:hidden">
            {t("all", { count: sheet.otherPicks.length })}
          </summary>
          <ul className="divide-y divide-border">{rest.map(line)}</ul>
        </details>
      ) : null}
    </Section>
  );
}
