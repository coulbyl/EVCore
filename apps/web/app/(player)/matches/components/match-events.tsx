import { getTranslations } from "next-intl/server";
import type { MatchSheet } from "@/domains/matches/types/match-sheet";

/** « 12' », « 45+1' ». */
function minuteOf(at: { minute: number; extraMinute: number | null }) {
  return at.extraMinute ? `${at.minute}+${at.extraMinute}'` : `${at.minute}'`;
}

/**
 * Under the score of a finished match: one line per goal (« 12' Konsa »,
 * « 45+1' Gyökeres (p.) », an own goal marked as such) with the side it
 * counts for, then the red cards. Nothing before the end, nor when the
 * events are not in (the server sends null rather than a wrong list).
 */
export async function MatchEvents({ sheet }: { sheet: MatchSheet }) {
  if (sheet.state !== "finished" || !sheet.scorers) return null;
  const t = await getTranslations("matches.sheet.events");
  const sideName = (team: "home" | "away") =>
    team === "home" ? sheet.home.shortName : sheet.away.shortName;
  const redCards = sheet.redCards ?? [];
  if (sheet.scorers.length === 0 && redCards.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 text-meta text-band-muted">
      {sheet.scorers.length > 0 ? (
        <ul aria-label={t("scorers")} className="flex flex-col gap-0.5">
          {sheet.scorers.map((goal) => (
            <li
              key={`${goal.minute}-${goal.extraMinute ?? 0}-${goal.player}-${goal.team}`}
              className="flex justify-between gap-3"
            >
              <span>
                <span className="score">{minuteOf(goal)}</span>{" "}
                <span className="text-band-foreground">{goal.player}</span>
                {goal.kind === "penalty" ? ` ${t("penalty")}` : null}
                {goal.kind === "own" ? ` ${t("ownGoal")}` : null}
              </span>
              <span>{sideName(goal.team)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {redCards.length > 0 ? (
        <ul aria-label={t("redCards")} className="flex flex-col gap-0.5">
          {redCards.map((card) => (
            <li
              key={`${card.minute}-${card.extraMinute ?? 0}-${card.player}`}
              className="flex justify-between gap-3"
            >
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-3 w-2 rounded-[1px] bg-loss-band"
                />
                <span className="sr-only">{`${t("redCard")} `}</span>
                <span>
                  <span className="score">{minuteOf(card)}</span>{" "}
                  <span className="text-band-foreground">{card.player}</span>
                </span>
              </span>
              <span>{sideName(card.team)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
