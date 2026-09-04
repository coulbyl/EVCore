import { Badge } from "@evcore/ui";
import type { ChannelStatus } from "@/domains/dashboard/types/dashboard";

// Basé sur la calibration (réel/annoncé), jamais le ROI — voir
// docs/vantage-centric-redesign-2026-09-01.md §5.4 : le ROI est trop bruyant
// à ce volume pour juger un canal (CLAUDE.md), la calibration est le
// standard déjà utilisé partout ailleurs dans le produit pour ce jugement.
const STATUS_LABEL: Record<ChannelStatus, string> = {
  GREEN: "Fiable",
  ORANGE: "À surveiller",
  RED: "Peu fiable",
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

export function ChannelStatusBadge({
  status,
  className,
}: {
  status: ChannelStatus;
  className?: string;
}) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
