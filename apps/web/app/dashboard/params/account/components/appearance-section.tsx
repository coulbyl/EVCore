"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { RadioGroup, RadioGroupItem } from "@evcore/ui";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { SettingsSectionCard } from "./settings-section-card";

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("account");
  const tTheme = useTranslations("theme");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const options = [
    { value: "light", label: tTheme("light"), icon: SunIcon },
    { value: "dark", label: tTheme("dark"), icon: MoonIcon },
    { value: "system", label: tTheme("system"), icon: MonitorIcon },
  ] as const;

  return (
    <SettingsSectionCard eyebrow={t("appearance")} title={t("theme")}>
      <RadioGroup
        value={mounted ? (theme ?? "system") : "system"}
        onValueChange={setTheme}
        className="mt-4 grid grid-cols-3 gap-3"
      >
        {options.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            htmlFor={`theme-${value}`}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-border bg-background px-3 py-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/10"
          >
            <RadioGroupItem
              id={`theme-${value}`}
              value={value}
              className="sr-only"
            />
            <Icon className="size-5 text-muted-foreground" />
            {label}
          </label>
        ))}
      </RadioGroup>
    </SettingsSectionCard>
  );
}
