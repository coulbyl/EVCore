import { CouponSheet } from "../../../../today/components/coupon-sheet";

/**
 * The same sheet on a shared link or a reload: no interception then, the
 * slot renders it over the « Aujourd'hui » screen (`today/coupon/[id]`).
 */
export default async function CouponSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CouponSheet id={id} />;
}
