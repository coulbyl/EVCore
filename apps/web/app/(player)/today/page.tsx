import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PlayerBand } from "@/components/scoreboard/shell/player-band";
import { getToday } from "@/domains/today/use-cases/get-today";
import { HeroCard } from "./components/hero-card";
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
 * (GET /today). Les états (soir, rien à jouer, panne, pause, hors ligne)
 * viennent en C2, la feuille du coupon en C3.
 */
export default async function Page() {
  const [t, today] = await Promise.all([getTranslations("shell"), getToday()]);
  const hero = today.coupons.find((coupon) => coupon.id === today.heroId);
  const hasYesterday = today.week
    ? today.week.products.some((product) => product.played > 0)
    : today.yesterday.length > 0;
  const others = today.coupons.filter((coupon) => coupon !== hero);

  return (
    <>
      <PlayerBand>
        {hasYesterday ? <YesterdayLine today={today} /> : null}
      </PlayerBand>
      <h1 className="sr-only">{t("tabs.today")}</h1>
      <div className="flex flex-col gap-2 px-4 pt-4 lg:px-6">
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
      </div>
    </>
  );
}
