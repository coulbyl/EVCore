"use client";

import { useTranslations } from "next-intl";
import { ScrollableTabs } from "@/components/scrollable-tabs";
import type { InvestmentMode } from "@/domains/investment/types/investment";

// Channel-based modes reuse the "decisions" channel labels (Valeur, Sécurité,
// Victoire, BB, Buts, Nul) instead of their own wording, so a canal is called
// the same thing everywhere in the app.
const CHANNEL_MODE_KEY: Record<
  Exclude<InvestmentMode, "probability">,
  string
> = {
  value: "VALUE",
  safe: "SAFE",
  dominant: "DOMINANT",
  btts: "BTTS",
  goals: "GOALS",
  draw: "DRAW",
};

const MODE_ORDER: InvestmentMode[] = [
  "probability",
  "value",
  "safe",
  "dominant",
  "btts",
  "goals",
  "draw",
];

export function InvestmentModeToggle({
  mode,
  onChange,
}: {
  mode: InvestmentMode;
  onChange: (mode: InvestmentMode) => void;
}) {
  const t = useTranslations("investment");
  const tChannels = useTranslations("decisions");

  const items = MODE_ORDER.map((value) => ({
    value,
    label:
      value === "probability"
        ? t("modeProbabilityLabel")
        : tChannels(`channels.${CHANNEL_MODE_KEY[value]}.label`),
  }));

  return <ScrollableTabs value={mode} onValueChange={onChange} items={items} />;
}
