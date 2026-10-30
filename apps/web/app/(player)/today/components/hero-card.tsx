import { getLocale, getTranslations } from "next-intl/server";
import { ChanceFigure } from "@/components/scoreboard/ui/chance-figure";
import { FormStrip } from "@/components/scoreboard/ui/form-strip";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import {
  displayLocaleOf,
  formatOdds,
  formatTime,
} from "@/helpers/scoreboard-format";
import type {
  TodayCoupon,
  TodayProductForm,
} from "@/domains/today/types/today";
import { FollowButton } from "./follow-button";
import { TeamMark } from "./team-mark";
import { HERO_FORM_DAYS, legPickLabel, recentForm } from "./today-constants";

/**
 * Le coupon héros (02 § 1, 03, maquette Main) : le produit, l'heure, les
 * équipes, le pari et sa cote 1xBet, « 8 sur 10 » et ses diodes, la forme
 * du produit, « Suivre ». Trois chiffres au plus : la cote, la chance, la
 * forme sans nombre (le décompte et la marge sont dans la feuille, C3).
 *
 * Un seul match (Favori, chasseur) : les deux équipes l'une sous l'autre et
 * le fait de la jambe. Un combiné : une ligne par match, la cote totale.
 */
export async function HeroCard({
  coupon,
  form,
}: {
  coupon: TodayCoupon;
  form: TodayProductForm | undefined;
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

  return (
    <section
      aria-labelledby="hero-title"
      className="flex flex-col gap-3 rounded-[0.875rem] border border-border bg-card p-4 text-card-foreground"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="hero-title" className="score text-title font-semibold">
          {t(`products.${coupon.product}`)}
        </h2>
        <span className="text-meta text-muted-foreground">
          {coupon.state === "live"
            ? t("inProgress")
            : formatTime(new Date(coupon.firstKickoffAt), display, timeZone)}
          {single ? ` · ${single.competition.name}` : null}
        </span>
      </div>

      {single ? (
        <div className="flex flex-col gap-2">
          {[single.home, single.away].map((team) => (
            <div
              key={team.name}
              className="flex items-center gap-2.5 text-bet font-medium"
            >
              <TeamMark team={team} />
              <span>{team.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {coupon.legs.map((leg) => (
            <li key={leg.fixtureId} className="flex flex-col">
              <span className="text-body font-medium">
                {leg.home.name} – {leg.away.name}
              </span>
              <span className="text-meta text-muted-foreground">
                {legPickLabel(leg)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
        <span className="text-bet font-semibold">
          {single
            ? legPickLabel(single)
            : t("matches", { count: coupon.legs.length })}
        </span>
        {coupon.odds !== null ? (
          <span className="score text-figure font-bold">
            {formatOdds(coupon.odds, display)}
          </span>
        ) : null}
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
        <FollowButton
          couponId={coupon.id}
          followed={coupon.followedByMe}
          labels={{
            follow: t("follow"),
            followed: t("followed"),
            error: t("followError"),
          }}
        />
      ) : null}
    </section>
  );
}
