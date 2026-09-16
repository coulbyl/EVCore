"use client";

import { Badge } from "@evcore/ui";
import { useTranslations } from "next-intl";
import type { ChannelStatus } from "@/domains/dashboard/types/dashboard";

// These are measurement bands, not recommendations or quality verdicts.
const STATUS_LABEL_KEY = {
  GREEN: "within15",
  ORANGE: "between15And30",
  RED: "above30",
  INACTIVE: "notMeasured",
  INSUFFICIENT_DATA: "insufficientVolume",
} as const satisfies Record<ChannelStatus, string>;

const STATUS_VARIANT: Record<
  ChannelStatus,
  "success" | "warning" | "destructive" | "neutral" | "outline"
> = {
  GREEN: "outline",
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
  const t = useTranslations("channelCalibrationStatus");
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {t(STATUS_LABEL_KEY[status])}
    </Badge>
  );
}
