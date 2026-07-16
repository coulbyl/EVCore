import { Badge } from "@evcore/ui";
import type { ChannelStatus } from "@/domains/dashboard/types/dashboard";

const STATUS_LABEL: Record<ChannelStatus, string> = {
  GREEN: "Positif",
  ORANGE: "Marge fine",
  RED: "Négatif",
  INACTIVE: "Inactif",
  INSUFFICIENT_DATA: "Échantillon insuffisant",
};

const STATUS_VARIANT: Record<
  ChannelStatus,
  "success" | "warning" | "destructive" | "neutral" | "outline"
> = {
  GREEN: "success",
  ORANGE: "warning",
  RED: "destructive",
  INACTIVE: "neutral",
  INSUFFICIENT_DATA: "outline",
};

export function ChannelStatusBadge({ status }: { status: ChannelStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
  );
}
