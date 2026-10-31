import { ResultsCouponSheet } from "../../../../results/components/results-coupon-sheet";

/** A settled coupon of « Jour par jour », on a tap and on a link. */
export default async function ResultsCouponPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ResultsCouponSheet id={id} />;
}
