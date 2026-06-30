"use client";

import { useTranslations } from "next-intl";
import { cn } from "@evcore/ui";

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
    <div className="inline-flex rounded-lg border border-border/60 p-0.5">
      <Tab active={view === "matches"} onClick={() => onChange("matches")}>
        {t("lens.matches")}
      </Tab>
      <Tab active={view === "channels"} onClick={() => onChange("channels")}>
        {t("lens.channels")}
      </Tab>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-[color:var(--accent-soft)] text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
