import { SheetSkeleton } from "@/components/scoreboard/states/sheet-skeleton";

/** The coupon rises at the tap while it loads (A2). */
export default function Loading() {
  return <SheetSkeleton fallbackHref="/today" tone="band" />;
}
