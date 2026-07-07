"use client";

import { useTranslations } from "next-intl";
import { ScrollableTabs } from "@/components/scrollable-tabs";

export type DecisionsView = "matches" | "channels";

// Segmented control to switch between the two lenses of the SAME data (by match
// / by channel) on a single route — the view lives in the URL, not in a second
// page.
export function LensToggle({
  view,
  onChange,
}: {
  view: DecisionsView;
  onChange: (view: DecisionsView) => void;
}) {
  const t = useTranslations("decisions");

  return (
    <ScrollableTabs
      value={view}
      onValueChange={onChange}
      items={[
        { value: "matches", label: t("lens.matches") },
        { value: "channels", label: t("lens.channels") },
      ]}
    />
  );
}
