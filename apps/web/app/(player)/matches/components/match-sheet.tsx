import Link from "next/link";
import { useId } from "react";
import { Stethoscope } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { getPlayerSession } from "@/domains/auth/use-cases/get-player-session";
import { Sheet } from "@/components/scoreboard/sheet/sheet";
import { activePause } from "@/components/scoreboard/states/paused-screen";
import { ChanceFigure } from "@/components/scoreboard/ui/chance-figure";
import { ChanceShort } from "@/components/scoreboard/ui/chance-short";
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
  clockLabelsOf,
  displayLocaleOf,
  formatClock,
  formatOdds,
  formatKickoff,
  formatShortDate,
  formatTime,
  type DisplayLocale,
} from "@/helpers/scoreboard-format";
import { TeamMark } from "../../today/components/team-mark";
import { AiSpeech } from "./ai-speech";
import { MatchEvents } from "./match-events";
import { pickLabel } from "./matches-constants";

/** « Autres paris » shown before « Tous » (maquette Fiche). */
const OTHER_PICKS_SHOWN = 4;

type Translate = Awaited<ReturnType<typeof getTranslations<"matches.sheet">>>;

/** A bet of the sheet in the player's words: « Rennes marque moins de 2,5 buts ». */
type LabelOf = (pick: SheetPick) => string;

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
  const [sheet, t, bets, locale, timeZone, session] = await Promise.all([
    getMatchSheet(id),
    getTranslations("matches.sheet"),
    getTranslations("betLabels"),
    getLocale(),
    getPlayerTimeZone(),
    getPlayerSession(),
  ]);
  // Every signed-in player opens the match's analysis from here (12-admin
  // § 2, open to players since 04/11): λ, factors, every reading the engine
  // set aside with its reason.
  const signedIn = session.status === "signed-in";
  const display = displayLocaleOf(locale);
  const muted = sheet.state === "postponed";
  const labelOf: LabelOf = (pick) => pickLabel(pick, sheet, bets);

  const decidedAt = (iso: string) =>
    t("aiDecidedAt", {
      date: formatShortDate(new Date(iso), display, timeZone),
      time: formatTime(new Date(iso), display, timeZone),
    });
  // The AI's price is today's 1xBet price, not the one it decided on: said
  // under its date (04/11), the last before kick-off once the match began.
  const aiOdds =
    sheet.state === "upcoming" ? t("aiOddsNow") : t("aiOddsKickoff");

  return (
    <Sheet
      title={`${sheet.home.name} – ${sheet.away.name}`}
      fallbackHref="/matches"
      tone="band"
      bandContent={
        <SheetHeader
          sheet={sheet}
          t={t}
          locale={display}
          timeZone={timeZone}
          now={new Date()}
          analysisHref={
            signedIn ? `/matches/${sheet.fixtureId}/analysis` : null
          }
        />
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
                labelOf={labelOf}
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
          {sheet.aiAbstention && !sheet.ai ? (
            <>
              <p className="text-body">{t("aiAbstains")}</p>
              <AiSpeech
                id={`ai-speech-${sheet.fixtureId}`}
                speech={sheet.aiAbstention.speech}
                labels={{
                  open: t("aiSpeech"),
                  title: t("ai"),
                  close: t("aiSpeechClose"),
                }}
              />
              <p className="text-meta text-muted-foreground">
                {decidedAt(sheet.aiAbstention.decidedAt)}
              </p>
            </>
          ) : !sheet.ai ? (
            <p className="text-body text-muted-foreground">{t("noAi")}</p>
          ) : (
            <>
              <PickLine
                pick={sheet.ai}
                sheet={sheet}
                t={t}
                locale={display}
                labelOf={labelOf}
              />
              {sheet.ai.sameAsReading || sheet.ai.passesWithReading ? (
                <p className="text-meta text-muted-foreground">
                  {t(
                    sheet.ai.sameAsReading
                      ? "sameAsReading"
                      : "passesWithReading",
                  )}
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
                {sheet.ai.odds !== null
                  ? `${decidedAt(sheet.ai.decidedAt)} · ${aiOdds}`
                  : decidedAt(sheet.ai.decidedAt)}
              </p>
            </>
          )}
        </Section>

        <Section title={t("form")}>
          <div className="grid grid-cols-[minmax(0,max-content)_1fr] items-center gap-x-3 gap-y-1">
            <FormLine team={sheet.home} form={sheet.form.home} t={t} />
            <FormLine team={sheet.away} form={sheet.form.away} t={t} />
          </div>
          {sheet.form.home.last.length > 0 ||
          sheet.form.away.last.length > 0 ? (
            <FormLegend t={t} />
          ) : null}
          {sheet.headToHead ? (
            <p className="text-body text-muted-foreground">
              {sheet.headToHead}
            </p>
          ) : null}
        </Section>

        {sheet.otherPicks.length > 0 ? (
          <OtherPicks sheet={sheet} t={t} locale={display} labelOf={labelOf} />
        ) : null}
      </div>
    </Sheet>
  );
}

/**
 * On the band: the competition, the two teams, then the time, « En cours »,
 * « Reporté », or the score with the half-time score in small (06 § 3),
 * and under it a finished match's scorers and red cards.
 */
function SheetHeader({
  sheet,
  t,
  locale,
  timeZone,
  now,
  analysisHref,
}: {
  sheet: MatchSheet;
  t: Translate;
  locale: DisplayLocale;
  timeZone: string;
  now: Date;
  /** Signed-in players: the match's analysis. */
  analysisHref: string | null;
}) {
  const status =
    sheet.state === "live"
      ? sheet.clock
        ? formatClock(sheet.clock, clockLabelsOf(t))
        : t("inProgress")
      : sheet.state === "postponed"
        ? t("postponed")
        : sheet.state === "finished" && sheet.halfTimeScore
          ? t("halfTime", sheet.halfTimeScore)
          : sheet.state === "finished"
            ? null
            : formatKickoff(new Date(sheet.kickoffAt), {
                now,
                locale,
                timeZone,
              });
  return (
    <div className="flex flex-col gap-2">
      <p className="flex justify-between gap-3 text-meta text-band-muted">
        <span>{sheet.competition.name}</span>
        <span className="flex items-center gap-2">
          {status ? <span className="score">{status}</span> : null}
          {analysisHref ? (
            <Link
              href={analysisHref}
              aria-label={t("analysis")}
              className="flex size-8 items-center justify-center rounded-full text-band-muted hover:text-band-foreground focus-visible:outline-2 focus-visible:outline-led-on"
            >
              <Stethoscope aria-hidden className="size-4" strokeWidth={2} />
            </Link>
          ) : null}
        </span>
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
      <MatchEvents sheet={sheet} />
    </div>
  );
}

/**
 * The [+] of a bet (06 § 2, 07 § 4): a match still to come, a bet with a
 * price. Live, finished or postponed: none (06 § 3). The new markets keep
 * their line, and their player in the label.
 */
function AddButton({
  pick,
  sheet,
  labelOf,
}: {
  pick: SheetPick;
  sheet: MatchSheet;
  labelOf: LabelOf;
}) {
  if (sheet.state !== "upcoming" || pick.odds === null) return null;
  return (
    <AddToTicket
      leg={{
        fixtureId: sheet.fixtureId,
        market: pick.market,
        pick: pick.pick,
        line: pick.line,
        label: labelOf(pick),
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
 * A bet with its price, « Victoire Arsenal 1,65 », and its mark once
 * the match is over. Its chance is written out under our reading;
 * « Autres paris » gives it in short next to the price (04/11).
 */
function PickLine({
  pick,
  sheet,
  t,
  locale,
  labelOf,
  strong = false,
}: {
  pick: SheetPick;
  sheet: MatchSheet;
  t: Translate;
  locale: DisplayLocale;
  labelOf: LabelOf;
  strong?: boolean;
}) {
  return (
    <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span className={strong ? "text-bet font-semibold" : "text-bet"}>
        {labelOf(pick)}
      </span>
      <span className="flex items-center gap-3">
        {pick.odds !== null ? (
          <span className="score text-bet font-semibold">
            {formatOdds(pick.odds, locale)}
          </span>
        ) : null}
        <Mark result={pick.result} t={t} />
        <AddButton pick={pick} sheet={sheet} labelOf={labelOf} />
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

/**
 * Five results, oldest first, and the days of rest (06 § 2): two cells of
 * the form's grid, the team's whole name (04/11: « Olympiakos Pir… » with
 * room left) and its marks, aligned with the other team's.
 */
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
    <>
      <span className="text-body font-medium break-words">{team.name}</span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
                  outcome === "won"
                    ? "won"
                    : outcome === "lost"
                      ? "lost"
                      : "void"
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
      </span>
    </>
  );
}

/**
 * What the marks mean, in short and visible (04/11): the form's marks are
 * the result signs of the whole app, here a match's result.
 */
function FormLegend({ t }: { t: Translate }) {
  const items = [
    ["won", t("formLegend.won")],
    ["lost", t("formLegend.lost")],
    ["void", t("formLegend.drawn")],
  ] as const;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted-foreground">
      {items.map(([kind, word]) => (
        <span key={kind} className="flex items-center gap-1">
          <ResultMark kind={kind} size="sm" />
          {word}
        </span>
      ))}
      <span>{t("formLegend.scope")}</span>
    </p>
  );
}

/**
 * The main 1xBet lines, the engine's other picks by market chance, then the
 * new markets (corners, cards, scorers, shots, minute), with their price
 * and, before the match, their chance in short, « 8/10 » (06 § 2, 04/11:
 * it helps compare 1,24 and 3,67); an unknown chance shows nothing. Once
 * the match is over, what landed, without price nor chance (06 § 3),
 * nothing while it is not known.
 */
function OtherPicks({
  sheet,
  t,
  locale,
  labelOf,
}: {
  sheet: MatchSheet;
  t: Translate;
  locale: DisplayLocale;
  labelOf: LabelOf;
}) {
  const finished = sheet.state === "finished";
  const line = (pick: SheetPick) => (
    <li
      key={`${pick.market}|${pick.pick}|${pick.line ?? ""}`}
      className="flex items-baseline justify-between gap-3 py-2"
    >
      <span className="text-body">{labelOf(pick)}</span>
      <span className="flex items-center gap-2 text-body">
        {!finished && pick.chance !== null ? (
          <ChanceShort probability={pick.chance} />
        ) : null}
        {!finished && pick.odds !== null ? (
          <span className="score font-semibold">
            {formatOdds(pick.odds, locale)}
          </span>
        ) : null}
        {finished ? <Mark result={pick.result} t={t} /> : null}
        <AddButton pick={pick} sheet={sheet} labelOf={labelOf} />
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
