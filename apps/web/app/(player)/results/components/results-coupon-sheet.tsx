import { Sheet } from "@/components/scoreboard/sheet/sheet";
import { getResultsCoupon } from "@/domains/results/use-cases/get-result-details";
import {
  CouponSheetBand,
  CouponSheetBody,
  CouponSheetFooter,
  couponSheetTitle,
} from "../../today/components/coupon-sheet";

/**
 * A coupon of « Jour par jour » opened (08 § 2): the coupon sheet of
 * Aujourd'hui (04 § 2), settled, its legs with their scores. Open during a
 * pause, without a button (08 § 4): a settled coupon cannot be followed.
 */
export async function ResultsCouponSheet({ id }: { id: string }) {
  const coupon = await getResultsCoupon(id);
  return (
    <Sheet
      title={await couponSheetTitle(coupon)}
      fallbackHref="/results"
      tone="band"
      bandContent={<CouponSheetBand coupon={coupon} />}
      footer={<CouponSheetFooter coupon={coupon} />}
    >
      <CouponSheetBody coupon={coupon} form={undefined} />
    </Sheet>
  );
}
