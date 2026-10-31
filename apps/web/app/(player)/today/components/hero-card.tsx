import { Check } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChanceFigure } from "@/components/scoreboard/ui/chance-figure";
import { ResultMark } from "@/components/scoreboard/ui/result-mark";
import { FormStrip } from "@/components/scoreboard/ui/form-strip";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import { displayLocaleOf, formatTime } from "@/helpers/scoreboard-format";
import type {
  TodayCoupon,
  TodayProductForm,
} from "@/domains/today/types/today";
import { CouponValue } from "./coupon-value";
import { FollowButton } from "./follow-button";
import { TeamMark } from "./team-mark";
import {
  HERO_FORM_DAYS,
  isSettled,
  legPickLabel,
  playedLegs,
  recentForm,
} from "./today-constants";

/**
 * Le coupon héros (02 § 1, 03, maquette Main) : le produit, l'heure, les
 * équipes, le pari et sa cote 1xBet, « 8 sur 10 » et ses diodes, la forme
 * du produit, « Suivre ». Trois chiffres au plus : la cote, la chance, la
 * forme sans nombre (le décompte et la marge sont dans la feuille, C3).
 *
 * Un seul match (Favori, chasseur) : les deux équipes l'une sous l'autre et
 * le fait de la jambe. Un combiné : une ligne par match, la cote totale.
 *
 * Toute la carte ouvre la feuille du coupon (un lien posé dessus) ; « Suivre »
 * passe au-dessus du lien.
 */
export async function HeroCard({
  coupon,
  form,
  couponPath = "/today/coupon",
}: {
  coupon: TodayCoupon;
  form: TodayProductForm | undefined;
  /** Where the card opens its coupon: Résultats opens yesterday's (08 § 3). */
  couponPath?: string;
}) {
  const [t, locale, timeZone] = await Promise.all([
    getTranslations("today"),
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const display = displayLocaleOf(locale);
  const single = coupon.legs.length === 1 ? coupon.legs[0] : undefined;
  const outcomes = recentForm(form, HERO_FORM_DAYS);
  const won = outcomes.filter((o) => o === "won").length;
  const played = outcomes.filter((o) => o === "won" || o === "lost").length;
  const settled = isSettled(coupon.state);

  return (
    <section
      aria-labelledby="hero-title"
      className="relative flex flex-col gap-3 rounded-[0.875rem] border border-border bg-card p-4 text-card-foreground"
    >
      <Link
        href={`${couponPath}/${coupon.id}`}
        aria-label={t("open", { product: t(`products.${coupon.product}`) })}
        className="absolute inset-0 rounded-[0.875rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="hero-title" className="score text-title font-semibold">
          {t(`products.${coupon.product}`)}
        </h2>
        <span className="text-meta text-muted-foreground">
          {coupon.state === "live"
            ? t("inProgress")
            : settled
              ? t("finished")
              : formatTime(new Date(coupon.firstKickoffAt), display, timeZone)}
          {single ? ` · ${single.competition.name}` : null}
        </span>
      </div>

      {single ? (
        <div className="flex flex-col gap-2">
          {(
            [
              [single.home, single.score?.home],
              [single.away, single.score?.away],
            ] as const
          ).map(([team, goals]) => (
            <div
              key={team.name}
              className="flex items-center gap-2.5 text-bet font-medium"
            >
              <TeamMark team={team} />
              <span className="flex-1">{team.name}</span>
              {goals !== undefined ? (
                <span className="score text-title font-bold">{goals}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {coupon.legs.map((leg) => (
            <li key={leg.fixtureId} className="flex items-center gap-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body font-medium">
                  {leg.home.name} – {leg.away.name}
                  {leg.score ? (
                    <span className="score ms-2 font-semibold">
                      {leg.score.home}-{leg.score.away}
                    </span>
                  ) : null}
                </span>
                <span className="text-meta text-muted-foreground">
                  {leg.state === "postponed"
                    ? t("postponed")
                    : legPickLabel(leg)}
                </span>
              </span>
              {leg.state === "won" ||
              leg.state === "lost" ||
              leg.state === "void" ? (
                <ResultMark
                  kind={leg.state}
                  label={t(leg.state === "void" ? "refunded" : leg.state)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
        <span className="text-bet font-semibold">
          {single
            ? legPickLabel(single)
            : t("matches", { count: playedLegs(coupon).length })}
        </span>
        <CouponValue coupon={coupon} locale={display} size="hero" />
      </div>

      {coupon.chance !== null ? (
        <ChanceFigure
          probability={coupon.chance}
          size="lg"
          className="justify-between"
        />
      ) : null}

      {single?.fact ? (
        <p className="text-body text-muted-foreground">{single.fact}</p>
      ) : null}

      {outcomes.length > 0 ? (
        <div className="border-t border-border pt-3">
          <FormStrip
            outcomes={outcomes}
            size="sm"
            label={t("form", { won, played })}
          />
        </div>
      ) : null}

      {coupon.canFollow ? (
        <div className="relative z-10">
          <FollowButton
            couponId={coupon.id}
            followed={coupon.followedByMe}
            labels={{
              follow: t("follow"),
              followed: t("followed"),
              error: t("followError"),
            }}
            firstFollow={{
              note: t("firstFollowNote"),
              ask: t("pushAsk"),
              yes: t("pushYes"),
              later: t("pushLater"),
            }}
            followedMark={
              <Check aria-hidden className="size-4" strokeWidth={2.5} />
            }
          />
        </div>
      ) : coupon.followedByMe ? (
        <p className="flex items-center gap-2 text-body font-medium">
          <ResultMark kind="won" colored={false} size="sm" />
          {t("followedDone")}
        </p>
      ) : null}
    </section>
  );
}
