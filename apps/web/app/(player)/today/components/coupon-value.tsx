import { getTranslations } from "next-intl/server";
import { ResultMark } from "@/components/scoreboard/ui/result-mark";
import { formatOdds, type DisplayLocale } from "@/helpers/scoreboard-format";
import type { TodayCoupon } from "@/domains/today/types/today";

/**
 * Ce que la carte et la ligne montrent à la place de la cote une fois le
 * coupon réglé (04 § 2) : ✓ ou ✗ en grand, la cote payée à côté en petit
 * (après un gain partiel, la cote réellement payée), « Remboursé » en gris.
 * Avant le règlement : la cote 1xBet.
 */
export async function CouponValue({
  coupon,
  locale,
  size,
}: {
  coupon: TodayCoupon;
  locale: DisplayLocale;
  /** `hero` : la cote du héros ; `row` : celle d'une ligne. */
  size: "hero" | "row";
}) {
  const t = await getTranslations("today");
  const odds = coupon.paidOdds ?? coupon.odds;
  const small = size === "hero" ? "text-bet" : "text-body";

  if (coupon.state === "void") {
    return (
      <span className="text-body text-muted-foreground">{t("refunded")}</span>
    );
  }
  if (coupon.state === "won" || coupon.state === "lost") {
    return (
      <span className="inline-flex items-center gap-2">
        <ResultMark
          kind={coupon.state}
          label={t(coupon.state)}
          size={size === "hero" ? "lg" : "md"}
        />
        {odds !== null ? (
          <span className={`score font-semibold ${small}`}>
            {formatOdds(odds, locale)}
          </span>
        ) : null}
      </span>
    );
  }
  if (odds === null) return null;
  return (
    <span
      className={
        size === "hero"
          ? "score text-figure font-bold"
          : "score text-bet font-semibold"
      }
    >
      {formatOdds(odds, locale)}
    </span>
  );
}
