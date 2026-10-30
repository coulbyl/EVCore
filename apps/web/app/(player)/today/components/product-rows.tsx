import { getLocale, getTranslations } from "next-intl/server";
import { ChanceFigure } from "@/components/scoreboard/ui/chance-figure";
import { Row, RowList } from "@/components/scoreboard/ui/row-list";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import {
  displayLocaleOf,
  formatOdds,
  formatTime,
} from "@/helpers/scoreboard-format";
import type { TodayAbsence, TodayCoupon } from "@/domains/today/types/today";
import { nextKickoff } from "./today-constants";

/**
 * Sous le héros (02 § 1) : les autres coupons du jour en lignes (nom, le
 * match ou le nombre de matchs, la cote, la chance), puis les produits
 * absents en gris avec la raison du moteur (04 § 5), puis mes coupons des
 * jours précédents encore en cours, qui mènent à Moi.
 */
export async function ProductRows({
  coupons,
  absences,
  followedInProgress,
}: {
  coupons: readonly TodayCoupon[];
  absences: readonly TodayAbsence[];
  followedInProgress: readonly TodayCoupon[];
}) {
  const [t, reasons, locale, timeZone] = await Promise.all([
    getTranslations("today"),
    getTranslations("couponAbstentions.reasons"),
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const display = displayLocaleOf(locale);
  if (
    coupons.length === 0 &&
    absences.length === 0 &&
    followedInProgress.length === 0
  ) {
    return null;
  }
  const next = nextKickoff(followedInProgress);

  return (
    <RowList label={t("otherCoupons")}>
      {coupons.map((coupon) => {
        const single = coupon.legs.length === 1 ? coupon.legs[0] : undefined;
        return (
          <Row
            key={coupon.id}
            title={t(`products.${coupon.product}`)}
            meta={
              single
                ? `${single.home.name} – ${single.away.name}`
                : t("matches", { count: coupon.legs.length })
            }
            value={
              <span className="flex items-baseline gap-4">
                {coupon.odds !== null ? (
                  <span className="score text-bet font-semibold">
                    {formatOdds(coupon.odds, display)}
                  </span>
                ) : null}
                {coupon.chance !== null ? (
                  <ChanceFigure
                    probability={coupon.chance}
                    showLeds={false}
                    size="sm"
                  />
                ) : null}
              </span>
            }
          />
        );
      })}
      {absences.map((absence) => (
        <Row
          key={absence.product}
          muted
          title={t("absent", { product: t(`shortNames.${absence.product}`) })}
          meta={
            reasons.has(absence.reason ?? "other")
              ? reasons(absence.reason ?? "other")
              : reasons("other")
          }
        />
      ))}
      {followedInProgress.length > 0 ? (
        <Row
          href="/me"
          title={
            next
              ? t("followedRunning", {
                  count: followedInProgress.length,
                  time: formatTime(next, display, timeZone),
                })
              : t("followedRunningDone", { count: followedInProgress.length })
          }
        />
      ) : null}
    </RowList>
  );
}
