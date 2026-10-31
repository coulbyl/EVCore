import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PlayerBand } from "@/components/scoreboard/shell/player-band";
import {
  activePause,
  PausedScreen,
} from "@/components/scoreboard/states/paused-screen";
import { getToday } from "@/domains/today/use-cases/get-today";
import { getPlayerSession } from "@/domains/auth/use-cases/get-player-session";
import { WelcomeLine } from "./components/welcome-line";
import { HeroCard } from "./components/hero-card";
import { NothingToPlay } from "./components/nothing-to-play";
import { RefreshWhileRunning } from "./components/refresh-while-running";
import { isSettled } from "./components/today-constants";
import { ProductRows } from "./components/product-rows";
import { YesterdayLine } from "./components/yesterday-line";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shell");
  return { title: `${t("tabs.today")} — EVCore` };
}

/**
 * « Aujourd'hui » (02 § 1, 04, maquette Main) : la ligne Hier dans le
 * bandeau, le coupon héros désigné par le serveur, les autres coupons, les
 * absents et mes coupons en cours. Rendu côté serveur en une lecture
 * (GET /today). La pause prime sur tout (04 § 5) : ni coupon ni ligne Hier,
 * et le serveur refuserait la lecture. Sans coupon : « Rien à jouer » ou,
 * sans même une abstention, la panne. Hors ligne : la ligne de la coquille
 * et « Suivre » grisé ; une erreur : l'état d'erreur de l'onglet.
 */
export default async function Page() {
  const [t, todayText, pauseEnd, session] = await Promise.all([
    getTranslations("shell"),
    getTranslations("today"),
    activePause(),
    getPlayerSession(),
  ]);
  if (pauseEnd) {
    return <PausedScreen until={pauseEnd} title={t("tabs.today")} />;
  }

  const today = await getToday();
  const hero = today.coupons.find((coupon) => coupon.id === today.heroId);
  const hasYesterday = today.week
    ? today.week.products.some((product) => product.played > 0)
    : today.yesterday.length > 0;
  const others = today.coupons.filter((coupon) => coupon !== hero);
  // The first launch (10 § 1): the welcome line, once, and an empty Hier.
  const firstLaunch =
    session.status === "signed-in" && !session.session.user.hasSeenOnboarding;
  const heroForm = today.forms.find(
    (form) => form.product === (hero?.product ?? "FAVOURITE"),
  );

  return (
    <>
      <PlayerBand>
        {hasYesterday ? (
          <YesterdayLine today={today} />
        ) : firstLaunch ? (
          <p className="flex items-baseline gap-3 text-meta text-band-muted">
            <span>{todayText("yesterday")}</span>
            <span>{todayText("yesterdayEmpty")}</span>
          </p>
        ) : null}
      </PlayerBand>
      <h1 className="sr-only">{t("tabs.today")}</h1>
      <RefreshWhileRunning
        active={[...today.coupons, ...today.followedInProgress].some(
          (coupon) => !isSettled(coupon.state),
        )}
      />
      <div className="flex flex-col gap-2 px-4 pt-4 lg:px-6">
        {firstLaunch ? <WelcomeLine form={heroForm} /> : null}
        {today.coupons.length === 0 ? (
          <NothingToPlay today={today} />
        ) : (
          <>
            {hero ? (
              <HeroCard
                coupon={hero}
                form={today.forms.find((form) => form.product === hero.product)}
              />
            ) : null}
            <ProductRows
              coupons={others}
              absences={today.absences}
              followedInProgress={today.followedInProgress}
            />
          </>
        )}
      </div>
    </>
  );
}
