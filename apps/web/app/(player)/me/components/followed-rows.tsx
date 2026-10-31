import { getLocale, getTranslations } from "next-intl/server";
import { Row, RowList } from "@/components/scoreboard/ui/row-list";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import type { TodayCoupon } from "@/domains/today/types/today";
import { displayLocaleOf, formatTime } from "@/helpers/scoreboard-format";
import { CouponValue } from "../../today/components/coupon-value";
import {
  isSettled,
  legPickLabel,
  playedLegs,
} from "../../today/components/today-constants";

/**
 * My followed coupons (09 § 1): the product, the first match's time (or
 * « En cours »), the match and the bet or « 3 matchs », the odds; once
 * settled, the mark and the odds paid. A tap opens the coupon: running in
 * the sheet of Aujourd'hui, settled in the one of Résultats.
 */
export async function FollowedRows({
  coupons,
  label,
}: {
  coupons: readonly TodayCoupon[];
  label: string;
}) {
  const [t, me, locale, timeZone] = await Promise.all([
    getTranslations("today"),
    getTranslations("me"),
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const display = displayLocaleOf(locale);
  return (
    <RowList label={label}>
      {coupons.map((coupon) => {
        const single = coupon.legs.length === 1 ? coupon.legs[0] : undefined;
        const settled = isSettled(coupon.state);
        return (
          <Row
            key={coupon.id}
            href={
              settled
                ? `/results/coupon/${coupon.id}`
                : `/today/coupon/${coupon.id}`
            }
            leading={
              settled ? null : (
                <span className="score inline-block w-12 text-meta font-semibold">
                  {coupon.state === "live"
                    ? me("inProgress")
                    : formatTime(
                        new Date(coupon.firstKickoffAt),
                        display,
                        timeZone,
                      )}
                </span>
              )
            }
            title={t(`products.${coupon.product}`)}
            meta={
              single
                ? `${single.home.name} – ${single.away.name} · ${legPickLabel(single)}`
                : t("matches", { count: playedLegs(coupon).length })
            }
            value={<CouponValue coupon={coupon} locale={display} size="row" />}
          />
        );
      })}
    </RowList>
  );
}
