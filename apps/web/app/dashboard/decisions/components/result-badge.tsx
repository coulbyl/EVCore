import { Badge } from "@evcore/ui";
import type { SelectionResult } from "@/domains/channel-decision/types/channel-decision";

const RESULT_META: Record<
  Exclude<SelectionResult, "PENDING">,
  { label: string; variant: "success" | "destructive" | "neutral" }
> = {
  WON: { label: "Gagné", variant: "success" },
  LOST: { label: "Perdu", variant: "destructive" },
  VOID: { label: "Annulé", variant: "neutral" },
};

export function ResultBadge({ result }: { result: SelectionResult | null }) {
  if (result === null || result === "PENDING") {
    return (
      <Badge variant="outline" className="text-[0.62rem]">
        En cours
      </Badge>
    );
  }
  const meta = RESULT_META[result];
  return (
    <Badge variant={meta.variant} className="text-[0.62rem]">
      {meta.label}
    </Badge>
  );
}
