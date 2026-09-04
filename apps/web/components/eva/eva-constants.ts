import { formatChannelForDisplayFr } from "@evcore/analysis-core";
import type { AnalysisSheetChannel } from "@/domains/analysis-sheet/types/analysis-sheet";

// Eva is a French-only internal export tool — no locale switch, so this
// always resolves the FR label. Labels come from
// @evcore/analysis-core's CHANNEL_LABELS_FR (single source of truth,
// shared with apps/web/app/dashboard/decisions/components/channel-constants.ts),
// not a second hardcoded map that can drift from it.
const ANALYSIS_SHEET_CHANNELS: AnalysisSheetChannel[] = [
  "VALUE",
  "SAFE",
  "DOMINANT",
  "BTTS",
  "DRAW",
  "GOALS",
];

export const ANALYSIS_SHEET_CHANNEL_OPTIONS: {
  value: AnalysisSheetChannel;
  label: string;
}[] = ANALYSIS_SHEET_CHANNELS.map((value) => ({
  value,
  label: formatChannelForDisplayFr(value),
}));
