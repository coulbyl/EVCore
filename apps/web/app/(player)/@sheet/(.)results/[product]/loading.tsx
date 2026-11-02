import { SheetSkeleton } from "@/components/scoreboard/states/sheet-skeleton";

/** A line of Résultats rises at the tap while it loads (A2). */
export default function Loading() {
  return <SheetSkeleton fallbackHref="/results" />;
}
