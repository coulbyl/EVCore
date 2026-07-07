import { Badge } from "@evcore/ui";

export type ResultValue = "PENDING" | "WON" | "LOST" | "VOID";

const RESULT_META: Record<
  Exclude<ResultValue, "PENDING">,
  { label: string; variant: "success" | "destructive" | "neutral" }
> = {
  WON: { label: "Gagné", variant: "success" },
  LOST: { label: "Perdu", variant: "destructive" },
  VOID: { label: "Annulé", variant: "neutral" },
};

/** Shared pick-result badge (decisions, investment): shows nothing while
 * pending, and — once a fixture is finished but the pick has no result yet —
 * an optional "Terminé" fallback. */
export function ResultBadge({
  result,
  finished = false,
}: {
  result: ResultValue | null;
  finished?: boolean;
}) {
  if (result === null || result === "PENDING") {
    return finished ? (
      <Badge variant="outline" className="text-[0.62rem]">
        Terminé
      </Badge>
    ) : null;
  }
  const meta = RESULT_META[result];
  return (
    <Badge variant={meta.variant} className="text-[0.62rem]">
      {meta.label}
    </Badge>
  );
}
