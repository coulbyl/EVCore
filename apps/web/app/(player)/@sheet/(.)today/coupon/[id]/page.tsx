import { CouponSheet } from "../../../../today/components/coupon-sheet";

/** A coupon of « Aujourd'hui » opened by a tap (04 § 1). */
export default async function InterceptedCouponSheet({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CouponSheet id={id} />;
}
