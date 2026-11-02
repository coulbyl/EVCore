import { SheetSkeleton } from "@/components/scoreboard/states/sheet-skeleton";

/** The match sheet rises at the tap while it loads (A2). */
export default function Loading() {
  return <SheetSkeleton fallbackHref="/matches" tone="band" />;
}
